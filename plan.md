# Feature Enhancement Plan - dotnet-project-toolkit

## Priority: High → Medium → Low

---

## 🚀 HIGH PRIORITY

### 1. Docker Deployment Support

- **Mô tả:** Thêm hỗ trợ deploy qua Docker thay vì chỉ IIS
- **Complexity:** Medium

### 2. Batch/Multi-project Deploy

- **Mô tả:** Deploy nhiều projects cùng lúc
- **Complexity:** Low

### 3. Deployment Rollback

- **Mô tả:** Quay lại version trước đó
- **Complexity:** Medium

### 4. Health Check sau Deploy

- **Mô tả:** Verify deployment thành công bằng HTTP check
- **Complexity:** Low

---

## 🟡 MEDIUM PRIORITY

### 5. Profile Templates

- **Mô tả:** Lưu/load template cho publish profile
- **Complexity:** Low

### 6. Profile Import/Export

- **Mô tả:** Chia sẻ profile giữa các projects
- **Complexity:** Low

### 7. SSH Connection Support

- **Mô tả:** Deploy qua SSH cho Linux servers
- **Complexity:** High

### 8. Azure App Service

- **Mô tả:** Hỗ trợ deploy lên Azure
- **Complexity:** High

### 9. Slack/Teams Notifications

- **Mô tả:** Gửi notification sau khi deploy
- **Complexity:** Low

### 10. Deployment Scheduling

- **Mô tả:** Hẹn giờ deploy
- **Complexity:** Medium

---

## 🟢 LOW PRIORITY

### 11. Log Search

- **Mô tả:** Tìm kiếm trong IIS logs
- **Complexity:** Medium

### 12. Deployment Statistics

- **Mô tả:** Dashboard thống kê deploy
- **Complexity:** Medium

### 13. Remote Debugging

- **Mô tả:** Attach debugger to remote IIS
- **Complexity:** High

### 14. Incremental Deploy

- **Mô tả:** Chỉ deploy các file thay đổi
- **Complexity:** High

### 15. Custom Environments

- **Mô tả:** Thêm môi trường tùy chỉnh ngoài DEV/STAGING/PROD
- **Complexity:** Low

---

## Progress Tracking

| #   | Feature                    | Priority | Status  |
| --- | -------------------------- | -------- | ------- |
| 1   | Docker Deployment Support  | High     | ⬜      |
| 2   | Batch/Multi-project Deploy | High     | ⬜      |
| 3   | Deployment Rollback        | High     | ✅ Done |
| 4   | Health Check sau Deploy    | High     | ✅ Done |
| 5   | Profile Templates          | Medium   | ⬜      |
| 6   | Profile Import/Export      | Medium   | ⬜      |
| 7   | SSH Connection Support     | Medium   | ⬜      |
| 8   | Azure App Service          | Medium   | ⬜      |
| 9   | Slack/Teams Notifications  | Medium   | ⬜      |
| 10  | Deployment Scheduling      | Medium   | ⬜      |
| 11  | Log Search                 | Low      | ⬜      |
| 12  | Deployment Statistics      | Low      | ⬜      |
| 13  | Remote Debugging           | Low      | ⬜      |
| 14  | Incremental Deploy         | Low      | ⬜      |
| 15  | Custom Environments        | Low      | ⬜      |

---

## Release Planning

### v0.2.0 (Next Release)

- [ ] Batch/Multi-project Deploy
- [ ] Health Check sau Deploy
- [ ] Profile Templates
- [ ] Profile Import/Export

### v0.3.0

- [ ] Docker Deployment Support
- [ ] Deployment Rollback

### v0.4.0

- [ ] Slack/Teams Notifications
- [ ] Deployment Scheduling

### v1.0.0

- [ ] SSH Connection Support
- [ ] Azure App Service
- [ ] Remote Debugging
- [ ] Incremental Deploy

### Future

- [ ] Custom Environments
- [ ] Log Search
- [ ] Deployment Statistics
