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
      } catch (readError) {
        console.warn('Database file not found or invalid, creating new database:', readError.message);
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
      throw error;
    }
  }

  // Group operations
  // Update the createGroup method to accept groupName parameter
  async createGroup(groupId, adminId, groupName = null) {
    try {
      // Get group name from Telegram API if not provided
      if (!groupName) {
        try {
          const chatInfo = await this.bot?.getChat?.(groupId);
          groupName = chatInfo?.title || `Group ${groupId}`;
        } catch (chatError) {
          console.warn(`Could not get group name for ${groupId}:`, chatError.message);
          groupName = `Group ${groupId}`;
        }
      }

      if (!this.data.groups) {
        this.data.groups = {};
      }

      this.data.groups[groupId] = {
        groupId: groupId,
        groupName: groupName, // Store the group name
        adminId: adminId,
        isSetupComplete: false,
        setupStep: null,
        config: {},
        users: {},
        createdAt: Date.now(),
      };

      await this.save();
      console.log(
        `✅ Created group "${groupName}" (${groupId}) with admin ${adminId}`
      );
    } catch (error) {
      console.error("Create group error:", error);
      throw error;
    }
  }

  // Add method to reset group setup for editing configuration
  async resetGroupSetup(groupId) {
    try {
      if (!this.data.groups?.[groupId]) {
        throw new Error(`Group ${groupId} not found`);
      }

      const group = this.data.groups[groupId];

      // Reset setup status but keep existing users and group info
      group.isSetupComplete = false;
      group.setupStep = null;
      // Keep existing config, users, and other data

      await this.save();
      console.log(`🔄 Reset setup for group ${groupId}`);
    } catch (error) {
      console.error("Reset group setup error:", error);
      throw error;
    }
  }

  // Enhanced getGroup method with fallback group name
  getGroup(groupId) {
    try {
      if (!this.data.groups?.[groupId]) return null;

      const group = this.data.groups[groupId];

      return {
        ...group,
        groupName: group.groupName || `Group ${groupId}`, // Ensure groupName is always present
      };
    } catch (error) {
      console.error("Get group error:", error);
      return null;
    }
  }

  updateGroupConfig(groupId, config) {
    const group = this.data.groups[groupId];
    if (group) {
      Object.assign(group.config, config);
      return this.save();
    }
  }

  // Method to update group name (useful if group title changes)
  async updateGroupName(groupId, newGroupName) {
    try {
      if (!this.data.groups?.[groupId]) {
        throw new Error(`Group ${groupId} not found`);
      }

      this.data.groups[groupId].groupName = newGroupName;
      await this.save();

      console.log(`📝 Updated group name for ${groupId} to "${newGroupName}"`);
    } catch (error) {
      console.error("Update group name error:", error);
      throw error;
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
      const expiryDate = new Date(
        Date.now() +
          (process.env.TEST_MODE === "true"
            ? 2 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000)
      ).toISOString();

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
  // Update getGroupsByAdmin to include group names
  getGroupsByAdmin(adminId) {
    try {
      if (!this.data.groups || !adminId) return [];

      return Object.values(this.data.groups)
        .filter((group) => group?.adminId === adminId)
        .map((group) => ({
          ...group,
          groupName: group.groupName || `Group ${group.groupId}`, // Ensure groupName is always present
        }));
    } catch (error) {
      console.error("Get groups by admin error:", error);
      return [];
    }
  }

  // Find group by admin ID (backward compatibility - returns first group)
  getGroupByAdmin(adminId) {
    const groups = this.getGroupsByAdmin(adminId);
    return groups.length > 0 ? groups[0] : null;
  }

  // Get all configured groups (for user selection)
  getConfiguredGroups() {
    try {
      if (!this.data.groups) return [];

      return Object.values(this.data.groups)
        .filter((group) => group?.isSetupComplete && group?.config)
        .map((group) => ({
          ...group,
          groupName: group.groupName || `Group ${group.groupId}`, // Ensure groupName is always present
        }));
    } catch (error) {
      console.error("Get configured groups error:", error);
      return [];
    }
  }

  // Update getAdminGroupsWithStatus to include proper status and group names
  getAdminGroupsWithStatus(adminId) {
    try {
      if (!this.data.groups || !adminId) return [];

      return Object.values(this.data.groups)
        .filter((group) => group?.adminId === adminId)
        .map((group) => {
          const activeUsers = group.users
            ? Object.values(group.users).filter((user) => user?.isActive).length
            : 0;

          return {
            ...group,
            groupName: group.groupName || `Group ${group.groupId}`,
            activeUsers: activeUsers,
          };
        });
    } catch (error) {
      console.error("Get admin groups with status error:", error);
      return [];
    }
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