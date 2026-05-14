import unittest

from app.routers.analysis import (
    _calc_rates,
    _calc_three_rate_scores,
    _grade_scope_class_ids_for_three_rates,
    _sort_three_rate_rank_rows,
    _subject_full_score_for_three_rates,
    _total_full_score_for_three_rates,
    _three_rate_rank_row_for_class,
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
                "low_rate_score": 100.0,
                "avg_score": 85.0,
            },
            {
                "class_name": "2班",
                "excellent_rate_score": 70.0,
                "good_rate_score": 85.0,
                "pass_rate_score": 90.0,
                "low_rate_score": 98.0,
                "avg_score": 82.0,
            },
        ]

        result = _sort_three_rate_rank_rows(rows)

        self.assertEqual(result[0]["class_name"], "1班")
        self.assertEqual(result[0]["total_score"], 450.0)
        self.assertEqual(result[1]["class_name"], "2班")
        self.assertEqual(result[1]["total_score"], 425.0)

    def test_three_rate_rank_row_includes_rates_and_scores(self):
        row = _three_rate_rank_row_for_class(
            class_id=3,
            class_name="八3班",
            grade="八年级",
            class_metrics={
                "excellent_rate": 0.48,
                "good_rate": 1.0,
                "pass_rate": 0.87,
                "low_rate": 0.92,
                "excellent_rate_score": 46.0,
                "good_rate_score": 100.0,
                "pass_rate_score": 87.0,
                "low_rate_score": 94.0,
                "avg_score": 68.0,
            },
        )

        self.assertEqual(row["class_id"], 3)
        self.assertEqual(row["class_name"], "八3班")
        self.assertEqual(row["grade"], "八年级")
        self.assertEqual(row["excellent_rate"], 0.48)
        self.assertEqual(row["good_rate"], 1.0)
        self.assertEqual(row["pass_rate"], 0.87)
        self.assertEqual(row["low_rate"], 0.92)
        self.assertEqual(row["excellent_rate_score"], 46.0)
        self.assertEqual(row["low_rate_score"], 94.0)

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

    def test_total_full_score_sums_exam_grade_subjects(self):
        subjects = [
            type("SubjectStub", (), {"name": "语文"})(),
            type("SubjectStub", (), {"name": "数学"})(),
            type("SubjectStub", (), {"name": "物理"})(),
        ]
        config = {
            "chinese_full_score": 110.0,
            "math_full_score": 130.0,
            "english_full_score": 125.0,
            "other_full_score": 70.0,
        }

        self.assertEqual(_total_full_score_for_three_rates(subjects, full_score_config=config), 310.0)

    def test_calc_three_rate_scores_can_use_total_full_score(self):
        class_scores = {
            1: [280, 245, 190, 80],
            2: [300, 260, 210, 100],
        }
        class_total_counts = {1: 4, 2: 4}

        result = _calc_three_rate_scores(
            class_scores,
            subject_name=None,
            full_score=310.0,
            class_total_counts=class_total_counts,
        )

        self.assertEqual(result[1]["excellent_count"], 1)  # 310*0.8=248
        self.assertEqual(result[1]["good_count"], 2)
        self.assertEqual(result[1]["pass_count"], 3)
        self.assertEqual(result[1]["low_count"], 1)
        self.assertEqual(result[2]["excellent_count"], 2)
        self.assertEqual(result[2]["excellent_rate_score"], 100.0)

    def test_calc_three_rate_scores_uses_fixed_full_score_thresholds(self):
        class_scores = {
            1: [96, 84, 72, 60],
            2: [120, 90, 80, 70],
        }
        class_total_counts = {1: 4, 2: 5}

        result = _calc_three_rate_scores(class_scores, subject_name="数学", class_total_counts=class_total_counts)

        self.assertEqual(result[1]["excellent_count"], 1)  # 120*0.8=96
        self.assertEqual(result[1]["good_count"], 2)
        self.assertEqual(result[1]["pass_count"], 3)
        self.assertEqual(result[1]["low_count"], 0)
        self.assertEqual(result[1]["avg_score"], 78.0)
        self.assertEqual(result[1]["excellent_rate_score"], 100.0)
        self.assertEqual(result[1]["good_rate_score"], 100.0)
        self.assertEqual(result[1]["pass_rate_score"], 100.0)

    def test_calc_three_rate_scores_uses_override_config(self):
        class_scores = {
            1: [87, 77, 65, 64],
            2: [110, 80, 70, 68],
        }
        class_total_counts = {1: 4, 2: 4}
        config = {
            "chinese_full_score": 110.0,
            "math_full_score": 120.0,
            "english_full_score": 120.0,
            "other_full_score": 60.0,
        }
        result = _calc_three_rate_scores(
            class_scores,
            subject_name="语文",
            full_score_config=config,
            class_total_counts=class_total_counts,
        )
        self.assertEqual(result[1]["excellent_count"], 0)  # 110*0.8=88
        self.assertEqual(result[2]["excellent_count"], 1)
        self.assertEqual(result[2]["excellent_rate_score"], 100.0)

    def test_calc_three_rate_scores_chinese_uses_120_full_score(self):
        class_scores = {
            1: [95, 88, 76, 60],
            2: [98, 92, 80, 70],
        }
        class_total_counts = {1: 4, 2: 4}

        result = _calc_three_rate_scores(class_scores, subject_name="语文", class_total_counts=class_total_counts)
        self.assertEqual(result[1]["excellent_count"], 0)
        self.assertEqual(result[2]["excellent_count"], 1)  # 120*0.8=96
        self.assertEqual(result[1]["excellent_rate_score"], 0.0)
        self.assertEqual(result[2]["excellent_rate_score"], 100.0)

    def test_calc_three_rate_scores_normalizes_rates_against_best_class(self):
        class_scores = {
            1: [54, 53, 36, 35],
            2: [60, 58, 50, 42],
        }
        class_total_counts = {1: 4, 2: 8}

        result = _calc_three_rate_scores(class_scores, subject_name="物理", class_total_counts=class_total_counts)

        self.assertEqual(result[1]["excellent_count"], 2)
        self.assertEqual(result[1]["good_count"], 2)
        self.assertEqual(result[1]["pass_count"], 3)
        self.assertEqual(result[1]["low_count"], 0)
        self.assertEqual(result[1]["excellent_rate"], 0.5)
        self.assertEqual(result[2]["excellent_rate"], 0.375)
        self.assertEqual(result[1]["excellent_rate_score"], 100.0)
        self.assertEqual(result[1]["good_rate_score"], 100.0)
        self.assertEqual(result[1]["pass_rate_score"], 100.0)
        self.assertEqual(result[1]["avg_score"], 44.5)

        self.assertEqual(result[2]["excellent_rate_score"], 75.0)
        self.assertEqual(result[2]["good_rate_score"], 100.0)
        self.assertEqual(result[2]["pass_rate_score"], 66.67)

    def test_calc_three_rate_scores_ranks_low_rate_with_ties(self):
        class_scores = {
            1: [60, 50, 10, 9],
            2: [60, 50, 19, 9],
            3: [60, 50, 19, 9],
        }
        class_total_counts = {1: 4, 2: 4, 3: 4}

        result = _calc_three_rate_scores(class_scores, subject_name="物理", class_total_counts=class_total_counts)

        self.assertEqual(result[2]["low_rate"], 0.25)
        self.assertEqual(result[3]["low_rate"], 0.25)
        self.assertEqual(result[1]["low_rate"], 0.5)
        self.assertEqual(result[2]["low_rate_score"], 100.0)
        self.assertEqual(result[3]["low_rate_score"], 100.0)
        self.assertEqual(result[1]["low_rate_score"], 98.0)

    def test_calc_three_rate_scores_gives_full_low_rate_score_when_no_class_has_low_scores(self):
        class_scores = {
            1: [90, 80, 70, 60],
            2: [88, 76, 66, 58],
            3: [86, 78, 68, 56],
        }
        class_total_counts = {1: 4, 2: 4, 3: 4}

        result = _calc_three_rate_scores(class_scores, subject_name="语文", class_total_counts=class_total_counts)

        self.assertEqual(result[1]["low_rate"], 0.0)
        self.assertEqual(result[2]["low_rate"], 0.0)
        self.assertEqual(result[3]["low_rate"], 0.0)
        self.assertEqual(result[1]["low_rate_score"], 100.0)
        self.assertEqual(result[2]["low_rate_score"], 100.0)
        self.assertEqual(result[3]["low_rate_score"], 100.0)

    def test_calc_three_rate_scores_excludes_empty_subject_classes_from_low_rate_rank(self):
        class_scores = {
            1: [60, 50, 10, 9],
            2: [60, 50, 19, 9],
            3: [],
        }
        class_total_counts = {1: 4, 2: 4, 3: 4}

        result = _calc_three_rate_scores(class_scores, subject_name="物理", class_total_counts=class_total_counts)

        self.assertEqual(result[2]["low_rate_score"], 100.0)
        self.assertEqual(result[1]["low_rate_score"], 98.0)
        self.assertEqual(result[3]["low_rate_score"], 0.0)

    def test_calc_rates_subject_distribution_uses_four_rate_thresholds(self):
        # For 60-point subjects, thresholds should be 48/42/36/18 by 80%/70%/60%/30%.
        rates = _calc_rates([60, 48, 42, 36, 30, 18, 17], max_score=60)
        self.assertEqual(rates["excellent_count"], 2)
        self.assertEqual(rates["good_count"], 3)
        self.assertEqual(rates["pass_count"], 4)
        self.assertEqual(rates["low_count"], 2)
        self.assertEqual(rates["fail_count"], 3)
        self.assertEqual(rates["excellent_rate"], round(2 / 7, 4))
        self.assertEqual(rates["good_rate"], round(3 / 7, 4))
        self.assertEqual(rates["pass_rate"], round(4 / 7, 4))
        self.assertEqual(rates["low_rate"], round(2 / 7, 4))
        self.assertEqual(rates["fail_rate"], round(3 / 7, 4))


if __name__ == "__main__":
    unittest.main()
