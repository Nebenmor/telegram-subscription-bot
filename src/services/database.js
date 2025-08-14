const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class Database {
  constructor() {
    this.dataFile = config.DATA_FILE;
    this.initialized = false;
  }

  async ensureDataFile() {
    if (this.initialized) return;
    
    try {
      const dir = path.dirname(this.dataFile);
      await fs.mkdir(dir, { recursive: true });
      
      try {
        await fs.access(this.dataFile);
      } catch {
        await fs.writeFile(this.dataFile, JSON.stringify({ users: [] }, null, 2));
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error ensuring data file:', error);
    }
  }

  async readData() {
    // Ensure data file exists before reading
    await this.ensureDataFile();
    
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      
      // Handle empty file
      if (!data.trim()) {
        console.log('Data file is empty, initializing with default structure');
        const defaultData = { users: [] };
        await this.writeData(defaultData);
        return defaultData;
      }

      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it
        console.log('Data file not found, creating new one');
        const defaultData = { users: [] };
        await this.writeData(defaultData);
        return defaultData;
      } else if (error instanceof SyntaxError) {
        // Invalid JSON, backup corrupted file and create new one
        console.error('Invalid JSON detected, backing up corrupted file');
        const backupPath = this.dataFile + '.corrupted.' + Date.now();
        try {
          await fs.copyFile(this.dataFile, backupPath);
          console.log(`Corrupted file backed up to: ${backupPath}`);
        } catch (backupError) {
          console.error('Failed to backup corrupted file:', backupError);
        }
        
        const defaultData = { users: [] };
        await this.writeData(defaultData);
        return defaultData;
      } else {
        console.error('Error reading data:', error);
        return { users: [] };
      }
    }
  }

  async writeData(data) {
    // Ensure data file exists before writing
    await this.ensureDataFile();
    
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing data:', error);
    }
  }

  async getUser(userId) {
    try {
      const data = await this.readData();
      return data.users.find(user => user.id === userId);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async addUser(user) {
    try {
      const data = await this.readData();
      const existingIndex = data.users.findIndex(u => u.id === user.id);
      
      if (existingIndex >= 0) {
        data.users[existingIndex] = { ...data.users[existingIndex], ...user };
      } else {
        data.users.push(user);
      }
      
      await this.writeData(data);
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const data = await this.readData();
      return data.users || [];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async removeUser(userId) {
    try {
      const data = await this.readData();
      data.users = data.users.filter(user => user.id !== userId);
      await this.writeData(data);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  }

  async getExpiredUsers() {
    try {
      const data = await this.readData();
      const now = new Date();
      const expiredDays = config.SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
      
      return data.users.filter(user => {
        if (!user.admittedAt || !user.admitted) return false;
        const admissionDate = new Date(user.admittedAt);
        return (now - admissionDate) > expiredDays;
      });
    } catch (error) {
      console.error('Error getting expired users:', error);
      return [];
    }
  }
}

module.exports = new Database();