---
event: PreToolUse
name: write-env-file
description: Writing to .env files that may contain secrets
pattern: \.env(\.|$)
tool: Write
level: medium
action: ask
---

# Writing to .env Files

This operation will modify environment configuration files that typically contain secrets.

**Why dangerous:**
- May overwrite API keys or database credentials
- Could expose secrets if written to wrong location
- Might break application configuration

**Consider:**
- Review the content being written
- Ensure no secrets are being exposed
- Use .env.example for templates instead
- Consider using a secrets manager for sensitive values
