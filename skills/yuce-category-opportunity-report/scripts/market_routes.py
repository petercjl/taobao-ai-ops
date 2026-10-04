"""Scale-invariant market segmentation and independent research queues."""
import math
from bisect import bisect_left, bisect_right


DEFAULT_POLICY = {
    "capacityQuantiles": [0.4, 0.7, 0.9],
    "minYoy": 0.2, "minSixMonthYoy": 0.2, "minPositiveMonths": 10,
    "shortlistLimit": 6,
    "why": "以本一级类目完整三级类目的容量分布形成可复核起点；结合偏斜、并列和业务目标复核分位点。",
}
LABELS = {"large": "大市场增量型", "medium": "中等容量持续增长型",
          "small": "中小容量成长型", "tail": "相对小容量观察", "unknown": "未分档"}


def quantile(values, p):
    if not values:
        return None
    position = (len(values) - 1) * p
    lo, hi = math.floor(position), math.ceil(position)
    return values[lo] + (values[hi] - values[lo]) * (position - lo)


def validate_policy(supplied):
    policy = dict(DEFAULT_POLICY)
    if supplied is not None:
        if not isinstance(supplied, dict) or set(supplied) - set(policy):
            raise ValueError("路线配置只接受分位点、增长条件、名额和理由；容量不接受绝对金额")
        policy.update(supplied)
        if not isinstance(supplied.get("why"), str) or len(supplied["why"].strip()) < 8:
            raise ValueError("调整路线参数须说明类目分布与经营目标依据")
    qs = policy["capacityQuantiles"]
    number = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)
    if not isinstance(qs, list) or len(qs) != 3 or not all(number(q) for q in qs) or not 0 < qs[0] < qs[1] < qs[2] < 1:
        raise ValueError("capacityQuantiles 须为三个严格递增的 0 到 1 之间的分位点")
    for key in ("minYoy", "minSixMonthYoy"):
        if not number(policy[key]) or not 0 <= policy[key] <= 5:
            raise ValueError("增长门槛须为 0 到 5 之间的有限数值")
    if type(policy["minPositiveMonths"]) is not int or not 1 <= policy["minPositiveMonths"] <= 12:
        raise ValueError("增长月份须为 1 到 12 的整数")
    if type(policy["shortlistLimit"]) is not int or not 1 <= policy["shortlistLimit"] <= 8:
        raise ValueError("每条路线名额须为 1 到 8 的整数")
    return policy


def classify(amount, cuts):
    # Equal amounts stay together, including on coincident boundaries.
    if amount >= cuts[2]:
        return "large"
    if amount >= cuts[1]:
        return "medium"
    if amount >= cuts[0]:
        return "small"
    return "tail"


def build_routes(stats, supplied=None):
    policy = validate_policy(supplied)
    leaves = [x for x in stats if x["level"] == 3]
    complete = [x for x in leaves if x["complete"]]
    eligible_base = [x for x in complete if x["recentAmount"] > 0]
    amounts = sorted(x["recentAmount"] for x in eligible_base)
    cuts = [quantile(amounts, p) for p in policy["capacityQuantiles"]]
    total = sum(amounts)
    root = next(x for x in stats if x["level"] == 1)
    warnings = []
    if len(amounts) < 10:
        warnings.append("有效类目少于10个，分位分档不稳定；保留空路线，不凑数。")
    if amounts and len(set(cuts)) < 3:
        warnings.append("分界金额重合；同额类目归入同一较高档，部分路线可能为空。")
    for item in leaves:
        item.update(capacityBand="unknown", capacityLabel=LABELS["unknown"], capacityPercentile=None,
                    sustainedGrowthIndex=None, routeRank=None, firstHalfYoy=None,
                    growthAccelerationPp=None, top3PositiveIncrementShare=None)
        item["growthImpactIndex"] = (100 * max(item["increment"], 0) / root["recentAmount"]
                                     * item["positiveYoyMonths"] / 12
                                     if item["complete"] and root["recentAmount"] > 0 else None)
        reasons = []
        if not item["complete"]:
            reasons.append("缺少完整24个月")
        elif item["recentAmount"] <= 0:
            reasons.append("最近一年无正成交额")
        else:
            band = classify(item["recentAmount"], cuts)
            item["capacityBand"], item["capacityLabel"] = band, LABELS[band]
            left, right = bisect_left(amounts, item["recentAmount"]), bisect_right(amounts, item["recentAmount"])
            item["capacityPercentile"] = 100 * (left + (right - left) / 2) / len(amounts)
            m = item["monthlyAmounts"]
            before = sum(m[:6])
            item["firstHalfYoy"] = sum(m[12:18]) / before - 1 if before > 0 else None
            if item["sixMonthYoy"] is not None and item["firstHalfYoy"] is not None:
                item["growthAccelerationPp"] = 100 * (item["sixMonthYoy"] - item["firstHalfYoy"])
            increments = sorted((max(m[i + 12] - m[i], 0) for i in range(12)), reverse=True)
            item["top3PositiveIncrementShare"] = sum(increments[:3]) / sum(increments) if sum(increments) else None
            if item["yoy"] is not None and item["sixMonthYoy"] is not None:
                item["sustainedGrowthIndex"] = 100 * min(item["yoy"], item["sixMonthYoy"]) * item["positiveYoyMonths"] / 12
            if band == "tail":
                reasons.append("低于本类目相对容量下界")
            if item["yoy"] is None or item["yoy"] < policy["minYoy"]:
                reasons.append("全年增长未达标或基期为零")
            if item["sixMonthYoy"] is None or item["sixMonthYoy"] < policy["minSixMonthYoy"]:
                reasons.append("近6个月增长未达标或基期为零")
            if item["positiveYoyMonths"] < policy["minPositiveMonths"]:
                reasons.append("增长月份未达标")
            if any(word in item["path"][-1] for word in ("其他", "其它")):
                reasons.append("混合类目须先拆解构成")
        item["routeExclusionReasons"] = reasons
    routes = []
    for key in ("large", "medium", "small"):
        metric = "growthImpactIndex" if key == "large" else "sustainedGrowthIndex"
        members = [x for x in leaves if x["capacityBand"] == key]
        pool = [x for x in members if not x["routeExclusionReasons"] and x[metric] is not None]
        pool.sort(key=lambda x: (-x[metric], -x["positiveYoyMonths"], tuple(x["path"])))
        for rank, item in enumerate(pool, 1):
            item["routeRank"] = rank
        routes.append({"id": key, "label": LABELS[key], "metric": metric,
                       "metricLabel": "持续增量贡献" if key == "large" else "持续增长强度",
                       "bandCount": len(members), "poolCount": len(pool),
                       "poolPaths": [x["path"] for x in pool],
                       "candidatePaths": [x["path"] for x in pool[:policy["shortlistLimit"]]],
                       "emptyReason": "本档没有满足数据与增长条件的类目，保留空名单。" if not pool else ""})
    # Sensitivity is diagnostic, never an automatic override or retrospective fit.
    sensitivity = []
    for offset in (-0.05, 0.05):
        qs = [p + offset for p in policy["capacityQuantiles"]]
        if not amounts or not 0 < qs[0] < qs[1] < qs[2] < 1:
            continue
        shifted = [quantile(amounts, p) for p in qs]
        moved = sum(classify(x["recentAmount"], shifted) != x["capacityBand"] for x in eligible_base)
        sensitivity.append({"quantiles": qs, "boundaryAmounts": shifted, "changedBandCount": moved})
    return {"policy": policy, "boundaryAmounts": cuts, "routes": routes,
            "distribution": {"completeCount": len(complete), "populationCount": len(amounts),
                             "incompleteCount": len(leaves) - len(complete),
                             "median": quantile(amounts, 0.5), "p10": quantile(amounts, 0.1),
                             "p90": quantile(amounts, 0.9),
                             "top10PercentGmvShare": sum(amounts[-max(1, math.ceil(len(amounts) * .1)):]) / total if total else None,
                             "tailCount": sum(x["capacityBand"] == "tail" for x in leaves)},
            "sensitivity": sensitivity, "warnings": warnings,
            "competitionStatus": "未验证；容量与增长不能推断品牌竞争、白牌份额或利润"}
