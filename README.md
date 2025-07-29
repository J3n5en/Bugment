# Bugment AI Code Review Action

[![GitHub release](https://img.shields.io/github/release/J3n5en/bugment.svg)](https://github.com/J3n5en/bugment/releases)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-bugment--ai--code--review-blue?logo=github)](https://github.com/marketplace/actions/bugment-ai-code-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful GitHub Action that provides AI-powered code review for Pull Requests using Augment AI. Get intelligent, comprehensive code analysis with detailed feedback on code quality, security, performance, and best practices.

## ✨ Features

- 🤖 **AI-Powered Analysis**: Deep code analysis using Augment AI technology
- 🔍 **Comprehensive Detection**: Identifies code smells, potential bugs, security issues, and performance problems
- 📝 **Automated Comments**: Posts detailed review results directly in Pull Request comments
- ⚡ **Fast & Reliable**: Automatic triggering with robust error handling
- 🎯 **Precise Feedback**: Provides specific file locations and actionable fix suggestions
- 🌐 **Multi-language Support**: Available in Chinese and English
- ⚙️ **Highly Configurable**: Customizable review levels, focus areas, and exclusion patterns
- 🔄 **Smart Comment Management**: Replace or append review comments as needed

## 🚀 Quick Start

### 1. Add to Your Workflow

Create `.github/workflows/code-review.yml` in your repository:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: AI Code Review
        uses: J3n5en/bugment@v1
        with:
          augment_access_token: ${{ secrets.AUGMENT_ACCESS_TOKEN }}
          augment_tenant_url: ${{ secrets.AUGMENT_TENANT_URL }}
```

### 2. Configure Secrets

Add these secrets to your repository settings:

- `AUGMENT_ACCESS_TOKEN`: Your Augment access token
- `AUGMENT_TENANT_URL`: Your Augment tenant URL

### 3. Get Your Augment Credentials

1. Log in to your Augment account
2. Navigate to API settings to find your access token
3. Copy your tenant URL and access token
4. Add them as repository secrets in GitHub

## 📋 Input Parameters

| Parameter              | Description                       | Required | Default               |
| ---------------------- | --------------------------------- | -------- | --------------------- |
| `augment_access_token` | Augment access token              | ✅       | -                     |
| `augment_tenant_url`   | Augment tenant URL                | ✅       | -                     |
| `github_token`         | GitHub token for posting comments | ✅       | `${{ github.token }}` |

## 📤 Outputs

| Output          | Description                                      |
| --------------- | ------------------------------------------------ |
| `review_result` | The generated code review result                 |
| `issues_found`  | Number of issues found during review             |
| `review_status` | Review status: `success`, `failed`, or `skipped` |

## 🎯 Review Features

Bugment provides comprehensive AI-powered code analysis including:

- **整体评价**: Overall PR quality assessment and improvement suggestions
- **Code Smells**: Maintainability and readability issues detection
- **潜在 Bug**: Potential functional errors and logic problems
- **安全问题**: Security vulnerabilities and risk identification
- **性能问题**: Performance optimization opportunities

The review output is provided in Chinese with detailed explanations and actionable fix suggestions.

## 📊 Example Usage

### Basic Setup

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: AI Code Review
        uses: J3n5en/bugment@v1
        with:
          augment_access_token: ${{ secrets.AUGMENT_ACCESS_TOKEN }}
          augment_tenant_url: ${{ secrets.AUGMENT_TENANT_URL }}
```

For a complete step-by-step guide, see [examples/complete-example.md](examples/complete-example.md).

## 🔧 Troubleshooting

### Common Issues

#### Authentication Failed

- Verify your `AUGMENT_ACCESS_TOKEN` and `AUGMENT_TENANT_URL` are correct
- Ensure the secrets are properly set in your repository settings
- Check that your Augment account has the necessary permissions

#### Review Timeout

- Large diffs may take longer to process
- Consider increasing `max_diff_size` or excluding large files
- Check Augment service status

#### No Comments Posted

- Verify the `github_token` has `pull-requests: write` permission
- Check if the workflow has the correct permissions block
- Ensure the action completed successfully in the workflow logs

### Debug Information

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- [GitHub Issues](https://github.com/J3n5en/bugment/issues)
- [GitHub Discussions](https://github.com/J3n5en/bugment/discussions)

---

_Made with ❤️ by the Bugment Team_
