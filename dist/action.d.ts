#!/usr/bin/env node
declare class BugmentAction {
    private inputs;
    private octokit;
    private prInfo;
    constructor();
    private parseInputs;
    private extractPRInfo;
    run(): Promise<void>;
    private setupAugmentAuth;
    private getWorkspaceDirectory;
    private generateDiffFile;
    private generateLocalDiff;
    private generateApiDiff;
    private performReview;
    private postReviewComment;
    private parseReviewResult;
    private parseIssueFromText;
    private mapSeverity;
    private extractTitleFromDescription;
    private getSeverityEmoji;
    private getTypeEmoji;
    private getTypeName;
    private getSeverityDistribution;
    private formatIssueForGitHub;
    private extractSummaryFromReview;
    private getPreviousReviewsAndDismissOld;
    private compareReviews;
    private getIssueSignature;
    private issuesAreSimilar;
    private formatReviewCommentWithStatus;
    private formatOriginalReviewContent;
    private createPullRequestReview;
}
export { BugmentAction };
//# sourceMappingURL=action.d.ts.map