# GitHub Integration & Contribution Tracking

This document explains **what database tables need to be modified, what new tables need to be created, and why** in order to support GitHub repository integration and contribution heatmaps in the Project Management System.

The design supports:

* Public and private GitHub repositories
* Automatic user ↔ GitHub username mapping
* GitHub-style contribution heatmaps
* Strict role-based access (Superadmin / PM / Member)

---

## 1. Roles & Access Rules

| Role           | Access                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| **Superadmin** | Can see all projects and everything in the system                                      |
| **PM**         | Can see only projects they are assigned to as PM, and everything inside those projects |
| **Member**     | Can see only their own data                                                            |

---

## 2. Tables to be MODIFIED

### 2.1 `User` (MODIFY)

#### Why

* Each user needs a single, global GitHub identity
* Used for automatic mapping when assigned to projects

#### Add the following field

```prisma
githubUsername String? @unique
```

#### Responsibility

* Stores the user’s GitHub username
* Optional (user may not have GitHub)
* Single source of truth

---

### 2.2 `Project` (MODIFY)

#### Why

* Each project may be linked to one GitHub repository
* Must support private repositories securely

#### Add the following fields

```prisma
githubOwner          String?
githubRepo           String?
githubInstallationId String?
```

#### Field meaning

| Field                  | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `githubOwner`          | Repository owner / organization                         |
| `githubRepo`           | Repository name                                         |
| `githubInstallationId` | GitHub App installation ID (required for private repos) |

All fields are nullable to keep GitHub optional per project.

---

### 2.3 `ProjectMember` (MODIFY)

#### Why

This table is the **core of the GitHub integration**:

* Defines project-level roles (PM vs Member)
* Stores GitHub username snapshot
* Tracks GitHub linking status

#### Add the following fields

```prisma
projectRole    ProjectRole @default(MEMBER)
githubUsername String?
githubStatus   GitHubStatus @default(UNLINKED)
```

#### Add a unique constraint

```prisma
@@unique([projectId, userId])
```

#### New enums required

```prisma
enum ProjectRole {
  PM
  MEMBER
}

enum GitHubStatus {
  LINKED
  UNLINKED
}
```

#### Responsibility

* Controls project visibility
* Snapshots GitHub username at assignment time
* Protects historical contribution data

---

## 3. Tables to be CREATED

### 3.1 `CommitActivity` (NEW – REQUIRED)

#### Why

* GitHub APIs should not be called on page load
* Contribution heatmaps must be fast
* Stores pre-aggregated commit counts

#### Table definition

```prisma
model CommitActivity {
  id           String   @id @default(uuid())
  projectId    String
  userId       String?
  activityDate DateTime
  commitCount  Int
  createdAt    DateTime @default(now())

  project      Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user         User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([projectId, userId, activityDate])
}
```

#### Meaning

| Column         | Description                              |
| -------------- | ---------------------------------------- |
| `projectId`    | Project being tracked                    |
| `userId`       | Contributor (null = unknown contributor) |
| `activityDate` | Date (YYYY-MM-DD)                        |
| `commitCount`  | Number of commits                        |

This table powers the **GitHub-style contribution heatmap**.

---

### 3.2 `GitHubSyncLog` (OPTIONAL)

#### Why

* Helps debug sync failures
* Useful for private repo access issues

```prisma
model GitHubSyncLog {
  id        String   @id @default(uuid())
  projectId String
  status    String
  message   String?
  syncedAt  DateTime @default(now())

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

---

## 4. What Does NOT Need Changes

The following tables remain unchanged:

* `Task`
* `FocusSession`
* `Log`
* `Token`
* `RefreshToken`

They are not involved in GitHub integration.

---

## 5. GitHub Integration Flow (Summary)

1. Admin / PM creates a project
2. GitHub repository is linked (public or private)
3. Users provide GitHub username during account creation
4. When users are assigned to a project:

   * GitHub username is automatically mapped
5. Background job syncs commits using GitHub App
6. Commit data is aggregated into `CommitActivity`
7. UI renders GitHub-style contribution heatmaps

---

## 6. Final Summary

### Tables Modified

* `User`
* `Project`
* `ProjectMember`

### Tables Created

* `CommitActivity` (required)
* `GitHubSyncLog` (optional)

This design is:

* Secure
* Scalable
* Private-repo safe
* Enterprise-ready
* Interview-ready

---

✅ This README can be used directly in your repository to explain the GitHub integration design.
