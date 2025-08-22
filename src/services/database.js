const fs = require("fs").promises;
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/database.json");

class Database {
  constructor() {
    this.data = null;
    this.processedUpdates = new Set();
  }

  async init() {
    try {
      await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

      try {
        const data = await fs.readFile(DB_PATH, "utf8");
        this.data = JSON.parse(data);
      } catch (error) {
        this.data = { groups: {} };
        await this.save();
      }
    } catch (error) {
      console.error("Database initialization error:", error);
      this.data = { groups: {} };
    }
  }

  async save() {
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Database save error:", error);
    }
  }

  // Group operations
  createGroup(groupId, adminId, groupName = null) {
    if (!this.data.groups[groupId]) {
      this.data.groups[groupId] = {
        adminId,
        groupName: groupName || `Group ${groupId}`,
        config: {
          bankName: "",
          accountName: "",
          accountNumber: "",
          price: "",
        },
        isSetupComplete: false,
        users: {},
        setupStep: null,
      };
    }
    return this.save();
  }

  getGroup(groupId) {
    return this.data.groups[groupId] || null;
  }

  updateGroupConfig(groupId, config) {
    const group = this.data.groups[groupId];
    if (group) {
      Object.assign(group.config, config);
      return this.save();
    }
  }

  updateGroupName(groupId, groupName) {
    const group = this.data.groups[groupId];
    if (group) {
      group.groupName = groupName;
      return this.save();
    }
  }

  setSetupComplete(groupId, complete = true) {
    const group = this.data.groups[groupId];
    if (group) {
      group.isSetupComplete = complete;
      group.setupStep = null;
      return this.save();
    }
  }

  setSetupStep(groupId, step) {
    const group = this.data.groups[groupId];
    if (group) {
      group.setupStep = step;
      return this.save();
    }
  }

  // User operations
  addUser(groupId, userId, username) {
    const group = this.data.groups[groupId];
    if (group) {
      const joinDate = new Date().toISOString();
      // For testing: 2 minutes, for production: 30 days
      const expiryDate = new Date(Date.now() + (process.env.TEST_MODE === 'true' ? 2 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)).toISOString();

      group.users[userId] = {
        username,
        joinDate,
        expiryDate,
        isActive: true,
      };
      return this.save();
    }
  }

  getUser(groupId, userId) {
    const group = this.data.groups[groupId];
    return group?.users?.[userId] || null;
  }

  removeUser(groupId, userId) {
    const group = this.data.groups[groupId];
    if (group?.users?.[userId]) {
      delete group.users[userId];
      return this.save();
    }
  }

  // Get all expired users across all groups
  getExpiredUsers() {
    const expired = [];
    const now = new Date();

    Object.entries(this.data.groups).forEach(([groupId, group]) => {
      Object.entries(group.users || {}).forEach(([userId, user]) => {
        if (user.isActive && new Date(user.expiryDate) <= now) {
          expired.push({ groupId, userId, user });
        }
      });
    });

    return expired;
  }

  // Find all groups by admin ID (MULTI-GROUP SUPPORT)
  getGroupsByAdmin(adminId) {
    return Object.entries(this.data.groups)
      .filter(([, group]) => group.adminId === adminId)
      .map(([groupId, group]) => ({ groupId, ...group }));
  }

  // Find group by admin ID (backward compatibility - returns first group)
  getGroupByAdmin(adminId) {
    const groups = this.getGroupsByAdmin(adminId);
    return groups.length > 0 ? groups[0] : null;
  }

  // Get all configured groups (for user selection)
  getConfiguredGroups() {
    return Object.entries(this.data.groups)
      .filter(([, group]) => group.isSetupComplete)
      .map(([groupId, group]) => ({ groupId, ...group }));
  }

  // Get groups by admin with setup status
  getAdminGroupsWithStatus(adminId) {
    return this.getGroupsByAdmin(adminId).map(group => ({
      ...group,
      userCount: Object.keys(group.users || {}).length,
      activeUsers: Object.values(group.users || {}).filter(user => user.isActive).length
    }));
  }

  // Duplicate message prevention
  isUpdateProcessed(updateId) {
    return this.processedUpdates.has(updateId);
  }

  markUpdateProcessed(updateId) {
    this.processedUpdates.add(updateId);

    // Clean old update IDs to prevent memory leaks
    if (this.processedUpdates.size > 1000) {
      const oldIds = Array.from(this.processedUpdates).slice(0, 500);
      oldIds.forEach((id) => this.processedUpdates.delete(id));
    }
  }
}

module.exports = new Database();