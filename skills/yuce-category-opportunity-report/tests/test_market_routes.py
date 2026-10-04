import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from market_routes import build_routes, validate_policy


def fixture(count=20):
    leaves = []
    for i in range(1, count + 1):
        before = [i * 100.0] * 12
        after = [i * 130.0] * 12
        leaves.append(dict(level=3, path=["示例", "分支", f"类目{i:02d}"], complete=True,
                           recentAmount=sum(after), priorAmount=sum(before), increment=sum(after)-sum(before),
                           yoy=.3, sixMonthYoy=.3, positiveYoyMonths=12, monthlyAmounts=before+after))
    return [dict(level=1, recentAmount=sum(x["recentAmount"] for x in leaves))] + leaves


class MarketRoutesTests(unittest.TestCase):
    def test_routes_partition_and_rank(self):
        stats = fixture()
        model = build_routes(stats)
        self.assertEqual([x["bandCount"] for x in model["routes"]], [2, 4, 6])
        self.assertEqual(model["distribution"]["tailCount"], 8)
        paths = [tuple(p) for r in model["routes"] for p in r["poolPaths"]]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(model["routes"][0]["candidatePaths"][0][-1], "类目20")
        self.assertEqual(model["routes"][1]["candidatePaths"][0][-1], "类目15")
        self.assertEqual(model["routes"][2]["candidatePaths"][0][-1], "类目09")
        self.assertEqual(len(model["sensitivity"]), 2)

    def test_scale_invariant(self):
        stats = fixture()
        baseline = build_routes(copy.deepcopy(stats))
        for factor in (.0001, 1e7):
            scaled = copy.deepcopy(stats)
            for x in scaled:
                for key in ("recentAmount", "priorAmount", "increment"):
                    if key in x:
                        x[key] *= factor
                if "monthlyAmounts" in x:
                    x["monthlyAmounts"] = [v*factor for v in x["monthlyAmounts"]]
            result = build_routes(scaled)
            self.assertEqual([r["candidatePaths"] for r in baseline["routes"]], [r["candidatePaths"] for r in result["routes"]])
            for old, new in zip(baseline["boundaryAmounts"], result["boundaryAmounts"]):
                self.assertAlmostEqual(new / factor, old)

    def test_ties_sparse_and_empty(self):
        stats = fixture(1)
        result = build_routes(stats)
        self.assertEqual([r["poolCount"] for r in result["routes"]], [1, 0, 0])
        self.assertTrue(result["warnings"])
        stats = fixture()
        for x in stats[1:]:
            x["recentAmount"] = 2000
        result = build_routes(stats)
        self.assertEqual([r["bandCount"] for r in result["routes"]], [20, 0, 0])
        self.assertTrue(result["routes"][1]["emptyReason"])
        result = build_routes([dict(level=1, recentAmount=0)])
        self.assertEqual(result["boundaryAmounts"], [None]*3)
        self.assertEqual([r["poolCount"] for r in result["routes"]], [0]*3)

    def test_missing_zero_base_decline_and_mixed(self):
        stats = fixture()
        stats[20]["complete"] = False
        stats[19]["yoy"] = None
        stats[18]["sixMonthYoy"] = -.1
        stats[17]["path"][-1] = "其它用品"
        stats[16]["positiveYoyMonths"] = 9
        result = build_routes(stats)
        selected = [p for r in result["routes"] for p in r["poolPaths"]]
        for x in stats[16:]:
            self.assertNotIn(x["path"], selected)
            self.assertTrue(x["routeExclusionReasons"])
        self.assertIsNone(stats[20]["sustainedGrowthIndex"])
        self.assertIsNone(stats[19]["sustainedGrowthIndex"])
        self.assertEqual(result["distribution"]["populationCount"], 19)

    def test_policy_rejects_absolute_and_invalid(self):
        for extra in ({"minRecentAmount": 2e8}, {"capacityQuantiles": [.5, .4, .9]},
                      {"capacityQuantiles": [0, .7, .9]}, {"minYoy": float("nan")},
                      {"shortlistLimit": 0}, {"minPositiveMonths": 10.5}):
            with self.assertRaises(ValueError):
                validate_policy({**extra, "why": "根据本类目分布调整并记录复核理由。"})

    def test_momentum_and_concentration(self):
        stats = fixture(1)
        x = stats[1]
        x.update(monthlyAmounts=[100]*12+[120]*6+[150]*6, yoy=.35, sixMonthYoy=.5,
                 recentAmount=1620, priorAmount=1200, increment=420)
        build_routes(stats)
        self.assertAlmostEqual(x["firstHalfYoy"], .2)
        self.assertAlmostEqual(x["growthAccelerationPp"], 30)
        self.assertAlmostEqual(x["top3PositiveIncrementShare"], 150/420)
        self.assertAlmostEqual(x["sustainedGrowthIndex"], 35)


if __name__ == "__main__":
    unittest.main()
