import unittest

from app.routers.analysis import (
    _calc_rates,
    _calc_three_rate_scores,
    _grade_scope_class_ids_for_three_rates,
    _sort_three_rate_rank_rows,
    _subject_full_score_for_three_rates,
)


class ThreeRatesOneScoreTests(unittest.TestCase):
    def test_grade_scope_class_ids_for_three_rates(self):
        all_class_ids = [1, 2, 3, 4]
        class_grade_map = {1: "七年级", 2: "八年级", 3: "八年级", 4: "九年级"}

        scoped = _grade_scope_class_ids_for_three_rates(all_class_ids, class_grade_map, target_class_id=2)
        self.assertEqual(scoped, [2, 3])

    def test_grade_scope_falls_back_when_target_grade_missing(self):
        all_class_ids = [1, 2, 3]
        class_grade_map = {1: "七年级", 2: "八年级", 3: "九年级"}

        scoped = _grade_scope_class_ids_for_three_rates(all_class_ids, class_grade_map, target_class_id=999)
        self.assertEqual(scoped, all_class_ids)

    def test_sort_three_rate_rank_rows_adds_total_and_sorts_desc(self):
        rows = [
            {
                "class_name": "1班",
                "excellent_rate_score": 80.0,
                "good_rate_score": 90.0,
                "pass_rate_score": 95.0,
                "avg_score": 85.0,
            },
            {
                "class_name": "2班",
                "excellent_rate_score": 70.0,
                "good_rate_score": 85.0,
                "pass_rate_score": 90.0,
                "avg_score": 82.0,
            },
        ]

        result = _sort_three_rate_rank_rows(rows)

        self.assertEqual(result[0]["class_name"], "1班")
        self.assertEqual(result[0]["total_score"], 350.0)
        self.assertEqual(result[1]["class_name"], "2班")
        self.assertEqual(result[1]["total_score"], 327.0)

    def test_subject_full_score_mapping(self):
        self.assertEqual(_subject_full_score_for_three_rates("语文"), 120.0)
        self.assertEqual(_subject_full_score_for_three_rates("数学"), 120.0)
        self.assertEqual(_subject_full_score_for_three_rates("英语"), 120.0)
        self.assertEqual(_subject_full_score_for_three_rates("物理"), 60.0)

    def test_subject_full_score_mapping_with_override(self):
        config = {
            "chinese_full_score": 110.0,
            "math_full_score": 130.0,
            "english_full_score": 125.0,
            "other_full_score": 70.0,
        }
        self.assertEqual(_subject_full_score_for_three_rates("语文", full_score_config=config), 110.0)
        self.assertEqual(_subject_full_score_for_three_rates("数学", full_score_config=config), 130.0)
        self.assertEqual(_subject_full_score_for_three_rates("英语", full_score_config=config), 125.0)
        self.assertEqual(_subject_full_score_for_three_rates("物理", full_score_config=config), 70.0)

    def test_calc_three_rate_scores_uses_fixed_full_score_thresholds(self):
        class_scores = {
            1: [108, 84, 72, 60],
            2: [120, 90, 80, 70],
        }

        result = _calc_three_rate_scores(class_scores, subject_name="数学")

        self.assertEqual(result[1]["excellent_count"], 1)
        self.assertEqual(result[1]["good_count"], 2)
        self.assertEqual(result[1]["pass_count"], 3)
        self.assertEqual(result[1]["avg_score"], 81.0)
        self.assertEqual(result[1]["excellent_rate_score"], 100.0)
        self.assertEqual(result[1]["good_rate_score"], 100.0)
        self.assertEqual(result[1]["pass_rate_score"], 100.0)

    def test_calc_three_rate_scores_uses_override_config(self):
        class_scores = {
            1: [98, 87, 65, 64],
            2: [110, 95, 70, 68],
        }
        config = {
            "chinese_full_score": 110.0,
            "math_full_score": 120.0,
            "english_full_score": 120.0,
            "other_full_score": 60.0,
        }
        result = _calc_three_rate_scores(class_scores, subject_name="语文", full_score_config=config)
        self.assertEqual(result[1]["excellent_count"], 0)  # 110*0.9=99
        self.assertEqual(result[2]["excellent_count"], 1)
        self.assertEqual(result[2]["excellent_rate_score"], 100.0)

    def test_calc_three_rate_scores_chinese_uses_120_full_score(self):
        class_scores = {
            1: [95, 88, 76, 60],
            2: [98, 92, 80, 70],
        }

        result = _calc_three_rate_scores(class_scores, subject_name="语文")
        self.assertEqual(result[1]["excellent_count"], 0)
        self.assertEqual(result[2]["excellent_count"], 0)
        self.assertEqual(result[1]["excellent_rate_score"], 0.0)
        self.assertEqual(result[2]["excellent_rate_score"], 0.0)

    def test_calc_three_rate_scores_normalizes_against_best_class(self):
        class_scores = {
            1: [54, 53, 36, 35],
            2: [60, 58, 50, 42],
        }

        result = _calc_three_rate_scores(class_scores, subject_name="物理")

        self.assertEqual(result[1]["excellent_count"], 1)
        self.assertEqual(result[1]["good_count"], 2)
        self.assertEqual(result[1]["pass_count"], 3)
        self.assertEqual(result[1]["excellent_rate_score"], 50.0)
        self.assertEqual(result[1]["good_rate_score"], 50.0)
        self.assertEqual(result[1]["pass_rate_score"], 75.0)
        self.assertEqual(result[1]["avg_score"], 44.5)

        self.assertEqual(result[2]["excellent_rate_score"], 100.0)
        self.assertEqual(result[2]["good_rate_score"], 100.0)
        self.assertEqual(result[2]["pass_rate_score"], 100.0)

    def test_calc_rates_subject_distribution_uses_percentage_threshold(self):
        # For 60-point subjects, thresholds should be 54/48/36 by 90%/80%/60%.
        rates = _calc_rates([54, 48, 36, 35], max_score=60)
        self.assertEqual(rates["excellent_count"], 1)
        self.assertEqual(rates["good_count"], 1)
        self.assertEqual(rates["pass_count"], 1)
        self.assertEqual(rates["fail_count"], 1)


if __name__ == "__main__":
    unittest.main()
