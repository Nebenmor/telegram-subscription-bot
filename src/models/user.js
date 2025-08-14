class User {
  constructor(id, username, firstName, lastName) {
    this.id = id;
    this.username = username;
    this.firstName = firstName;
    this.lastName = lastName;
    this.requestedAt = new Date().toISOString();
    this.admitted = false;
    this.admittedAt = null;
    this.paymentRequested = false;
  }

  admit() {
    this.admitted = true;
    this.admittedAt = new Date().toISOString();
  }

  getDisplayName() {
    return this.firstName + (this.lastName ? ` ${this.lastName}` : '') + 
           (this.username ? ` (@${this.username})` : '');
  }

  getDaysRemaining() {
    if (!this.admitted || !this.admittedAt) return 0;
    
    const admissionDate = new Date(this.admittedAt);
    const now = new Date();
    const daysPassed = Math.floor((now - admissionDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = 30 - daysPassed;
    
    return Math.max(0, daysRemaining);
  }
}

module.exports = User;
