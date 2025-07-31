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
    private parseIssuesFromSection;
    private parseIssueFromText;
    private parseLocationInfo;
    private mapSeverity;
    private extractTitleFromDescription;
    private getFilesWithIssues;
    private getSeverityEmoji;
    private getTypeEmoji;
    private getTypeName;
    private getSeverityDistribution;
    private formatIssueForGitHub;
    private extractSummaryFromReview;
    private getPreviousReviewsAndDismissOld;
    private markResolvedLineComments;
    private isCommentStillRelevant;
    private compareReviews;
    private getIssueSignature;
    private issuesAreSimilar;
    private formatMainReviewComment;
    private formatOriginalReviewContent;
    private formatLineComment;
    private getSeverityText;
    private determineReviewEvent;
    private createUnifiedPullRequestReview;
}
export { BugmentAction };
//# sourceMappingURL=action.d.ts.map