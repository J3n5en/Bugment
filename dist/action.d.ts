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
    private extractSummaryFromReview;
    private getPreviousReviews;
    private compareReviews;
    private getIssueSignature;
    private issuesAreSimilar;
    private formatReviewCommentWithStatus;
    private formatOriginalReviewContent;
    private formatIssue;
    private createNewReviewComment;
}
export { BugmentAction };
//# sourceMappingURL=action.d.ts.map