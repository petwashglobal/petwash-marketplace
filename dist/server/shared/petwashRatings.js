// FILE: shared/petwashRatings.ts
// Pet Wash™ - Rating System
// Computes average ratings, identifies low performers, and triggers auto-reviews
export function computeRatingSummary(contractorId, ratings) {
    const contractorRatings = ratings.filter((r) => r.contractorId === contractorId);
    if (contractorRatings.length === 0) {
        return {
            contractorId,
            totalRatings: 0,
            averageScore: 0,
            last30DaysAverage: 0,
            autoFlag: "OK",
        };
    }
    // Calculate overall average
    const totalScore = contractorRatings.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalScore / contractorRatings.length;
    // Calculate last 30 days average
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRatings = contractorRatings.filter((r) => new Date(r.createdAt) >= thirtyDaysAgo);
    let last30DaysAverage = 0;
    if (recentRatings.length > 0) {
        const recentTotal = recentRatings.reduce((sum, r) => sum + r.score, 0);
        last30DaysAverage = recentTotal / recentRatings.length;
    }
    else {
        last30DaysAverage = averageScore;
    }
    // Determine auto-flag
    let autoFlag = "OK";
    // WATCH: Average below 3.5 or recent average below 3.0
    if (averageScore < 3.5 || last30DaysAverage < 3.0) {
        autoFlag = "WATCH";
    }
    // AUTO_REVIEW: Average below 2.5 or recent average below 2.0
    if (averageScore < 2.5 || last30DaysAverage < 2.0) {
        autoFlag = "AUTO_REVIEW";
    }
    return {
        contractorId,
        totalRatings: contractorRatings.length,
        averageScore,
        last30DaysAverage,
        autoFlag,
    };
}
