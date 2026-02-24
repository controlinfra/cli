# Controlinfra CLI

Command-line interface for Controlinfra - Infrastructure Drift Detection.

## Installation

### Linux / macOS

```bash
curl -fsSL https://controlinfra.com/cli/install.sh | bash
```

### Windows (PowerShell)

```powershell
iwr -useb https://controlinfra.com/cli/install.ps1 | iex
```

### Windows (Git Bash)

```bash
curl -fsSL https://controlinfra.com/cli/install.sh | bash
```

## Quick Start

```bash
# Login via browser
controlinfra login

# Add a repository
controlinfra repos add owner/my-terraform-repo

# Run a drift scan
controlinfra scan run owner/my-terraform-repo --wait

# View detected drifts
controlinfra drifts list

# Generate AI fix for a drift
controlinfra drifts fix <drift-id>

# Create a PR with the fix
controlinfra drifts pr <drift-id>
```

## Commands

### Authentication

```bash
controlinfra login              # Authenticate via browser
controlinfra login --token XXX  # Authenticate with API token
controlinfra logout             # Clear credentials
controlinfra whoami             # Show current user
```

### Workspace Management

Workspaces organize repositories by cloud provider and environment.

```bash
controlinfra workspaces list                    # List all workspaces
controlinfra workspaces add <name>              # Create a workspace
controlinfra workspaces info <id>               # Show workspace details
controlinfra workspaces remove <id>             # Delete a workspace
controlinfra workspaces default <id>            # Set default workspace
```

#### Creating Workspaces by Cloud Provider

```bash
# AWS workspace
controlinfra workspaces add "Production AWS" --cloud-provider aws

# Azure workspace
controlinfra workspaces add "Production Azure" --cloud-provider azure

# GCP workspace
controlinfra workspaces add "Production GCP" --cloud-provider gcp
```

### Repository Management

```bash
controlinfra repos list                    # List configured repos
controlinfra repos add owner/repo          # Add a repository
controlinfra repos remove <id>             # Remove a repository
controlinfra repos info <id>               # Show repo details
controlinfra repos stats <id>              # Show repo statistics
```

#### Adding Repositories with AWS

```bash
# Using AWS credentials (Access Key + Secret Key)
controlinfra repos add owner/repo \
  --cloud-provider aws \
  --auth-method credentials \
  --access-key AKIAXXXXXXXX \
  --secret-key wJalrXXXXXXXX \
  --region us-east-1 \
  --terraform-dir infrastructure/

# Using IAM Instance Profile (self-hosted runner on EC2)
controlinfra repos add owner/repo \
  --cloud-provider aws \
  --auth-method instance_profile \
  --region us-west-2 \
  --runner-type self-hosted \
  --runner-id <runner-id>

# Using Assume Role
controlinfra repos add owner/repo \
  --cloud-provider aws \
  --auth-method assume_role \
  --role-arn arn:aws:iam::123456789:role/TerraformRole \
  --external-id MyExternalId \
  --runner-type self-hosted \
  --runner-id <runner-id>
```

#### Adding Repositories with Azure

```bash
# Using Service Principal
controlinfra repos add owner/repo \
  --cloud-provider azure \
  --azure-auth-method service_principal \
  --subscription-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --tenant-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --client-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --client-secret your-client-secret \
  --terraform-dir infrastructure-azure/

# Using Managed Identity (self-hosted runner on Azure VM)
controlinfra repos add owner/repo \
  --cloud-provider azure \
  --azure-auth-method managed_identity \
  --subscription-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --runner-type self-hosted \
  --runner-id <runner-id>

# Using Azure Government
controlinfra repos add owner/repo \
  --cloud-provider azure \
  --azure-auth-method service_principal \
  --azure-environment usgovernment \
  --subscription-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --tenant-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --client-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --client-secret your-client-secret
```

#### Adding Repositories with GCP

```bash
# Using Service Account JSON file (recommended)
controlinfra repos add owner/repo \
  --cloud-provider gcp \
  --gcp-auth-method service_account \
  --gcp-json-file /path/to/service-account.json \
  --terraform-dir infrastructure-gcp/

# Using Service Account credentials directly
controlinfra repos add owner/repo \
  --cloud-provider gcp \
  --gcp-auth-method service_account \
  --gcp-project-id my-project-id \
  --gcp-client-email terraform@my-project.iam.gserviceaccount.com \
  --gcp-private-key "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Using Workload Identity (self-hosted runner on GCE/GKE)
controlinfra repos add owner/repo \
  --cloud-provider gcp \
  --gcp-auth-method workload_identity \
  --gcp-project-id my-project-id \
  --runner-type self-hosted \
  --runner-id <runner-id>
```

#### Assigning to Workspaces

```bash
# Add repo to a specific workspace
controlinfra repos add owner/repo \
  --workspace <workspace-id> \
  --cloud-provider aws \
  --access-key AKIAXXXXXXXX \
  --secret-key wJalrXXXXXXXX
```

### Scanning

```bash
controlinfra scan run <repo>               # Trigger a scan
controlinfra scan run <repo> --wait        # Wait for completion
controlinfra scan status <scan-id>         # Check scan status
controlinfra scan wait <scan-id>           # Wait for scan
controlinfra scan list                     # List recent scans
controlinfra scan cancel <scan-id>         # Cancel a scan
controlinfra scan logs <scan-id>           # Show scan logs
```

**Note:** You can use partial IDs (last 8 characters) for scan commands.

### Drift Management

```bash
controlinfra drifts list                   # List all drifts
controlinfra drifts list --severity high   # Filter by severity
controlinfra drifts show <drift-id>        # Show drift details
controlinfra drifts fix <drift-id>         # Generate AI fix
controlinfra drifts pr <drift-id>          # Create PR with fix
controlinfra drifts ignore <drift-id>      # Ignore a drift
controlinfra drifts resolve <drift-id>     # Mark as resolved
controlinfra drifts stats                  # Show statistics
```

### Self-Hosted Runners

```bash
controlinfra runners list                  # List runners
controlinfra runners add prod-01           # Create runner
controlinfra runners setup <id>            # Get install script
controlinfra runners status <id>           # Check status
controlinfra runners remove <id>           # Delete runner
controlinfra runners token <id>            # Regenerate token
```

### Integrations

#### Slack

```bash
controlinfra slack setup --webhook <url>   # Configure Slack
controlinfra slack test                    # Send test message
controlinfra slack status                  # Show status
controlinfra slack remove                  # Remove integration
```

#### AWS Credentials (Account-wide)

```bash
controlinfra aws setup                     # Interactive setup
controlinfra aws setup --access-key X --secret-key Y
controlinfra aws status                    # Show status
controlinfra aws test                      # Validate creds
controlinfra aws remove                    # Remove credentials
```

#### Azure Credentials (Account-wide)

```bash
controlinfra azure setup                   # Interactive setup
controlinfra azure setup \
  --subscription-id XXX \
  --tenant-id XXX \
  --client-id XXX \
  --client-secret XXX
controlinfra azure status                  # Show status
controlinfra azure remove                  # Remove credentials
```

#### GCP Credentials (Account-wide)

```bash
controlinfra gcp setup                     # Interactive setup
controlinfra gcp setup --json-file /path/to/key.json  # From JSON file
controlinfra gcp setup \
  --project-id my-project \
  --client-email sa@project.iam.gserviceaccount.com \
  --private-key "-----BEGIN..."
controlinfra gcp status                    # Show status
controlinfra gcp remove                    # Remove credentials
```

#### AI Provider (BYOK)

```bash
controlinfra ai status                     # Show current provider
controlinfra ai use anthropic --key <key>  # Use Anthropic
controlinfra ai use openai --key <key>     # Use OpenAI
controlinfra ai verify                     # Verify API key
controlinfra ai remove                     # Remove custom key
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Drift Detection

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - name: Install Controlinfra CLI
        run: curl -fsSL https://controlinfra.com/cli/install.sh | bash

      - name: Authenticate
        run: controlinfra login --token ${{ secrets.CONTROLINFRA_TOKEN }}

      - name: Run Drift Scan
        run: |
          controlinfra scan run ${{ github.repository }} --wait

      - name: Check for Critical Drifts
        run: |
          DRIFTS=$(controlinfra drifts list --severity critical,high --json)
          if [ $(echo "$DRIFTS" | jq length) -gt 0 ]; then
            echo "::error::Critical drifts detected!"
            controlinfra drifts list --severity critical,high
            exit 1
          fi
```

### GitLab CI

```yaml
drift-detection:
  image: ubuntu:latest
  script:
    - apt-get update && apt-get install -y curl
    - curl -fsSL https://controlinfra.com/cli/install.sh | bash
    - controlinfra login --token $CONTROLINFRA_TOKEN
    - controlinfra scan run $CI_PROJECT_PATH --wait
    - controlinfra drifts list --json > drift-report.json
  artifacts:
    paths:
      - drift-report.json
```

## Output Formats

```bash
# Table format (default)
controlinfra drifts list

# JSON format
controlinfra drifts list --json

# Quiet mode (exit code only)
controlinfra scan run repo --wait --quiet
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CONTROLINFRA_TOKEN` | API token for authentication |
| `CONTROLINFRA_API_URL` | Custom API URL (for self-hosted) |

## Configuration

Config is stored in `~/.config/controlinfra-nodejs/config.json`

## Cloud Provider Comparison

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Auth Methods** | credentials, instance_profile, assume_role | service_principal, managed_identity | service_account, workload_identity |
| **Credential Storage** | Access Key + Secret Key | Client ID + Client Secret | JSON Key File |
| **IAM Integration** | Instance Profile, Assume Role | Managed Identity | Workload Identity |
| **Self-Hosted Required** | For instance_profile, assume_role | For managed_identity | For workload_identity |

## License

MIT
