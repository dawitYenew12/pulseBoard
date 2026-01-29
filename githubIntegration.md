# GitHub Integration & Contribution Tracking – System Design

## 1. Purpose
This document describes the end-to-end design for integrating GitHub repositories (public and private) into the Project Management System (PMS) in order to track project and user-level contribution activity using GitHub-style contribution heatmaps.

The goal is to allow Admins / Project Managers (PMs) to link a GitHub repository to a project and automatically visualize commit activity for assigned users based on their GitHub usernames.

---

## 2. High-Level Overview

### Key Capabilities
- Link a GitHub repository during project creation
- Support **public and private repositories**
- Automatically map project users to GitHub contributors
- Display GitHub-style contribution heatmaps
- Provide project-wide and per-user commit analytics

### Updated Role Definitions
- **Super Admin**: Can see **all projects**, all users, and **everything** in the system
- **Project Manager (PM)**: Can see **only projects they are assigned to as PM**, and everything *inside those projects*
- **Member**: Can see **only their own data** within projects they are assigned to

---


## 3. Core Design Principles

- Single source of truth for GitHub usernames
- Zero friction during project assignment
- Secure access to private repositories
- Cached and aggregated data (no live GitHub calls on UI load)
- Enterprise-grade authentication using GitHub Apps

---

## 4. Data Model

### User
Stores global user information, including GitHub identity.

```
User
- id
- name
- email
- role
- github_username (nullable)
```

---

### Project
Stores project metadata and GitHub repository linkage.

```
Project
- id
- name
- description
- github_owner
- github_repo
- github_installation_id
```

---

### ProjectMember
Represents assignment of a user to a project.

```
ProjectMember
- project_id
- user_id
- github_username
- github_status (linked | unlinked)
```

> Note: `github_username` is copied at assignment time to preserve historical correctness.

---

### CommitActivity (Aggregated)
Stores pre-computed contribution data.

```
CommitActivity
- project_id
- user_id (nullable for unassigned commits)
- date (YYYY-MM-DD)
- commit_count
```

---

## 5. Project Creation Flow

### Step-by-Step
1. Admin / PM creates a project
2. Selects **Connect GitHub Repository**
3. Redirected to GitHub App installation (if not installed)
4. Selects repository (public or private)
5. System stores:
   - repository owner
   - repository name
   - GitHub App installation ID

---

## 6. GitHub Authentication Strategy

### Chosen Approach: GitHub App

#### Why GitHub App
- Supports private repositories
- Repository-scoped permissions
- Higher API rate limits
- No personal tokens stored
- Industry-standard (used by Jira, Slack, Linear)

#### Required Permissions
- Repository Metadata: Read
- Repository Contents: Read
- (Optional) Organization Members: Read

---

## 7. User Creation Flow

1. Admin or user creates account
2. User provides GitHub username (optional but recommended)
3. Username is stored globally in the User record

No repository access is required at this stage.

---

## 8. User Assignment Flow

When a user is assigned to a project:

- System automatically reads `User.github_username`
- Copies it into `ProjectMember.github_username`
- Sets `github_status`:
  - `linked` if username exists
  - `unlinked` if missing

No manual mapping is required.

---

## 9. Commit Synchronization

### Background Job (Cron / Worker)

Runs periodically (e.g., every 6–12 hours):

1. Generate GitHub App installation token
2. Fetch commits for the repository
3. Extract:
   - commit date
   - author GitHub username
4. Match commits to `ProjectMember.github_username`
5. Aggregate commits by:
   - project
   - user
   - day
6. Store results in `CommitActivity`

> UI never calls GitHub APIs directly.

---

## 10. Contribution Visualization

### Project-Level View
- Combined contribution heatmap (all users)
- Total commits
- Active days percentage
- Activity trends

### User-Level View
- GitHub-style contribution heatmap
- Commit count
- Last active date
- Inactivity indicators (optional)

---

## 11. Permissions & Access Control

| Role | Access |
|-----|-------|
| Super Admin | Full access to all projects, users, GitHub repositories, and analytics |
| Project Manager (PM) | Access only to projects where they are assigned as PM, including all members and GitHub analytics within those projects |
| Member | Access only to their own contribution data within assigned projects |

---
--|-------|
| Member | Own contribution data |
| Admin / PM | Project-wide + member analytics |
| Super Admin | All projects and analytics |

---

## 12. Edge Case Handling

- **Private repo access revoked**: Sync fails gracefully, prompt reconnection
- **User without GitHub username**: Shown as unlinked
- **GitHub username change**: Admin can re-sync mapping
- **Commits from non-project users**: Shown as unknown contributors

---

## 13. Security Considerations

- No storage of personal access tokens
- All GitHub access via short-lived installation tokens
- Repository access limited to explicitly selected repos
- Audit-friendly and organization-safe

---

## 14. Future Enhancements

- Inactivity alerts
- Contribution badges
- Commit-to-task correlation
- Velocity tracking vs deadlines
- Webhook-based real-time sync

---

## 15. Summary

This design provides a secure, scalable, and enterprise-grade solution for integrating GitHub contribution tracking into the Project Management System. It supports both public and private repositories, minimizes user friction, and delivers meaningful insights for project managers and administrators.

