# Chess: Rifts of Chaos - Public Beta Deployment Guide

## 🌐 Domain Setup: RiftsofChaos.com

### Purchasing & DNS Configuration (GoDaddy)

1. **Purchase Domain**
   - Go to GoDaddy.com and purchase `riftsofchaos.com`
   - Total cost: ~$12-15/year for .com domain

2. **DNS Configuration**
   - After purchasing, go to your GoDaddy domain management
   - Navigate to DNS settings
   - You'll configure these records after choosing your hosting provider

---

## 🚀 Hosting Options & Recommendations

### **Option 1: Heroku (Easiest for Beginners) ⭐ RECOMMENDED FOR BETA**

**Pros:**
- Free tier available (with credit card verification)
- Very easy deployment with Git
- Handles SSL certificates automatically
- Great for MVP/Beta testing
- Built-in scaling

**Cons:**
- Free tier apps sleep after 30 minutes of inactivity
- Limited free dyno hours per month (can upgrade for $7/month)

**Cost:**
- Free tier: $0 (sleeps after inactivity)
- Hobby tier: $7/month (never sleeps, custom domain)
- Standard: $25-50/month (autoscaling, metrics)

**Setup Steps:**

1. **Create Heroku Account**
   - Go to heroku.com and sign up
   - Verify your account with credit card (for free tier)

2. **Install Heroku CLI**
   ```bash
   # Download from: https://devcenter.heroku.com/articles/heroku-cli
   # Or use npm:
   npm install -g heroku
   ```

3. **Deploy Your App**
   ```bash
   # Login to Heroku
   heroku login

   # Create a new app
   heroku create rifts-of-chaos

   # Add buildpack for Node.js
   heroku buildpacks:set heroku/nodejs

   # Deploy
   git push heroku main

   # Scale web dyno
   heroku ps:scale web=1
   ```

4. **Add Custom Domain**
   ```bash
   # Add domain to Heroku
   heroku domains:add www.riftsofchaos.com
   heroku domains:add riftsofchaos.com

   # Heroku will give you DNS targets (like abc123.herokudns.com)
   ```

5. **Configure GoDaddy DNS**
   - Go to GoDaddy DNS settings
   - Add CNAME record: `www` → `your-app-name.herokuapp.com`
   - Add A record: `@` → Use Heroku's IP or use domain forwarding to www
   - Or use Heroku's DNS target provided in step 4

6. **SSL Certificate**
   - Heroku automatically provides free SSL via Let's Encrypt
   - Enable with: `heroku certs:auto:enable`

---

### **Option 2: DigitalOcean (Best Balance of Cost & Performance)**

**Pros:**
- Very affordable ($6/month for basic droplet)
- Excellent performance
- Full control over server
- No sleep/idle issues
- Great documentation

**Cons:**
- Requires more technical setup
- Need to manage server updates/security
- Need to configure SSL manually (though easy with Certbot)

**Cost:**
- Basic Droplet: $6/month (1GB RAM, 25GB SSD)
- Better Performance: $12/month (2GB RAM, 50GB SSD)
- Database (managed): $15/month (if needed later)

**Setup Steps:**

1. **Create DigitalOcean Account**
   - Go to digitalocean.com
   - Get $200 free credit for 60 days (new accounts)

2. **Create Droplet**
   - Choose Ubuntu 22.04 LTS
   - Select $6/month plan
   - Choose datacenter region closest to your users
   - Add SSH key for security

3. **Initial Server Setup**
   ```bash
   # SSH into your droplet
   ssh root@your_droplet_ip

   # Update system
   apt update && apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs

   # Install PM2 (process manager)
   npm install -g pm2

   # Install Nginx (web server)
   apt install -y nginx

   # Install Certbot (for SSL)
   apt install -y certbot python3-certbot-nginx
   ```

4. **Deploy Your Application**
   ```bash
   # Clone your repository
   cd /var/www
   git clone https://github.com/YourUsername/chess-rifts-of-chaos.git
   cd chess-rifts-of-chaos

   # Install dependencies
   npm install

   # Start with PM2
   pm2 start server.js --name rifts-of-chaos
   pm2 startup
   pm2 save
   ```

5. **Configure Nginx**
   ```bash
   # Create Nginx config
   nano /etc/nginx/sites-available/riftsofchaos.com
   ```

   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name riftsofchaos.com www.riftsofchaos.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   # Enable site
   ln -s /etc/nginx/sites-available/riftsofchaos.com /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

6. **Configure DNS (GoDaddy)**
   - Add A record: `@` → Your droplet IP
   - Add A record: `www` → Your droplet IP

7. **Setup SSL**
   ```bash
   # Get free SSL certificate
   certbot --nginx -d riftsofchaos.com -d www.riftsofchaos.com
   ```

---

### **Option 3: Railway (Modern Alternative to Heroku)**

**Pros:**
- Very easy deployment
- Free tier with $5 credit/month
- Automatic SSL
- Great developer experience
- No sleeping apps

**Cons:**
- Newer platform (less documentation)
- Free tier limited to $5/month usage

**Cost:**
- Free tier: $5 credit/month
- Hobby: $20/month

**Setup:**
1. Go to railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects Node.js and deploys
5. Add custom domain in settings
6. Configure DNS in GoDaddy to point to Railway

---

## 👤 User Account System Implementation

### **Phase 1: Basic Authentication (For Beta Release)**

For your public beta, I recommend starting with a **simple but secure** authentication system:

#### Technology Stack:
- **Passport.js** - Authentication middleware
- **MongoDB** - User database (free tier on MongoDB Atlas)
- **JWT (JSON Web Tokens)** - Session management
- **bcrypt** - Password hashing

#### Features for Beta:
1. Email/Password registration
2. Email verification
3. Login/Logout
4. Password reset
5. User profiles (username, avatar, stats)
6. Session persistence

#### Implementation Steps:

1. **Add Dependencies**
   ```bash
   npm install passport passport-local passport-jwt jsonwebtoken bcryptjs mongoose express-session nodemailer
   ```

2. **Create User Model** (`models/User.js`)
   ```javascript
   const mongoose = require('mongoose');
   const bcrypt = require('bcryptjs');

   const userSchema = new mongoose.Schema({
       username: {
           type: String,
           required: true,
           unique: true,
           trim: true,
           minlength: 3,
           maxlength: 20
       },
       email: {
           type: String,
           required: true,
           unique: true,
           lowercase: true,
           trim: true
       },
       password: {
           type: String,
           required: true,
           minlength: 6
       },
       emailVerified: {
           type: Boolean,
           default: false
       },
       verificationToken: String,
       resetPasswordToken: String,
       resetPasswordExpires: Date,
       createdAt: {
           type: Date,
           default: Date.now
       },
       // Game statistics
       stats: {
           gamesPlayed: { type: Number, default: 0 },
           gamesWon: { type: Number, default: 0 },
           gamesLost: { type: Number, default: 0 },
           riftsActivated: { type: Number, default: 0 },
           totalPlayTime: { type: Number, default: 0 }
       },
       // Friends list
       friends: [{
           type: mongoose.Schema.Types.ObjectId,
           ref: 'User'
       }],
       // Leaderboard points
       rating: {
           type: Number,
           default: 1000
       }
   });

   // Hash password before saving
   userSchema.pre('save', async function(next) {
       if (!this.isModified('password')) return next();
       this.password = await bcrypt.hash(this.password, 10);
       next();
   });

   // Compare password method
   userSchema.methods.comparePassword = async function(candidatePassword) {
       return await bcrypt.compare(candidatePassword, this.password);
   };

   module.exports = mongoose.model('User', userSchema);
   ```

3. **Setup MongoDB Atlas (Free Database)**
   - Go to mongodb.com/cloud/atlas
   - Create free account
   - Create cluster (M0 free tier - 512MB storage)
   - Create database user
   - Whitelist IP (0.0.0.0/0 for now, restrict later)
   - Get connection string
   - Add to `.env` file: `MONGODB_URI=mongodb+srv://...`

4. **Create Authentication Routes** (`routes/auth.js`)
   ```javascript
   const express = require('express');
   const router = express.Router();
   const jwt = require('jsonwebtoken');
   const crypto = require('crypto');
   const User = require('../models/User');
   const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

   // Register
   router.post('/register', async (req, res) => {
       try {
           const { username, email, password } = req.body;

           // Check if user exists
           const existingUser = await User.findOne({ $or: [{ email }, { username }] });
           if (existingUser) {
               return res.status(400).json({ error: 'User already exists' });
           }

           // Create verification token
           const verificationToken = crypto.randomBytes(32).toString('hex');

           // Create user
           const user = new User({
               username,
               email,
               password,
               verificationToken
           });

           await user.save();

           // Send verification email
           await sendVerificationEmail(user.email, verificationToken);

           res.status(201).json({ 
               message: 'Registration successful! Please check your email to verify your account.',
               userId: user._id
           });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   // Verify Email
   router.get('/verify/:token', async (req, res) => {
       try {
           const user = await User.findOne({ verificationToken: req.params.token });
           if (!user) {
               return res.status(400).json({ error: 'Invalid verification token' });
           }

           user.emailVerified = true;
           user.verificationToken = undefined;
           await user.save();

           res.json({ message: 'Email verified successfully!' });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   // Login
   router.post('/login', async (req, res) => {
       try {
           const { email, password } = req.body;

           // Find user
           const user = await User.findOne({ email });
           if (!user) {
               return res.status(401).json({ error: 'Invalid credentials' });
           }

           // Check password
           const isMatch = await user.comparePassword(password);
           if (!isMatch) {
               return res.status(401).json({ error: 'Invalid credentials' });
           }

           // Check email verification
           if (!user.emailVerified) {
               return res.status(401).json({ error: 'Please verify your email first' });
           }

           // Generate JWT
           const token = jwt.sign(
               { userId: user._id, username: user.username },
               process.env.JWT_SECRET,
               { expiresIn: '7d' }
           );

           res.json({
               token,
               user: {
                   id: user._id,
                   username: user.username,
                   email: user.email,
                   stats: user.stats,
                   rating: user.rating
               }
           });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   // Get Current User
   router.get('/me', authenticateToken, async (req, res) => {
       try {
           const user = await User.findById(req.userId).select('-password');
           res.json(user);
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   module.exports = router;
   ```

5. **Create Middleware** (`middleware/auth.js`)
   ```javascript
   const jwt = require('jsonwebtoken');

   function authenticateToken(req, res, next) {
       const token = req.headers['authorization']?.split(' ')[1];

       if (!token) {
           return res.status(401).json({ error: 'Access denied' });
       }

       try {
           const decoded = jwt.verify(token, process.env.JWT_SECRET);
           req.userId = decoded.userId;
           req.username = decoded.username;
           next();
       } catch (error) {
           return res.status(403).json({ error: 'Invalid token' });
       }
   }

   module.exports = { authenticateToken };
   ```

6. **Update server.js**
   ```javascript
   const express = require('express');
   const mongoose = require('mongoose');
   require('dotenv').config();

   // Connect to MongoDB
   mongoose.connect(process.env.MONGODB_URI, {
       useNewUrlParser: true,
       useUnifiedTopology: true
   }).then(() => {
       console.log('Connected to MongoDB');
   }).catch(err => {
       console.error('MongoDB connection error:', err);
   });

   // Add auth routes
   const authRoutes = require('./routes/auth');
   app.use('/api/auth', authRoutes);
   ```

7. **Create .env file**
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_very_secret_random_string
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_specific_password
   ```

---

### **Phase 2: Social Features**

#### Global Leaderboard

1. **Create Leaderboard Endpoint** (`routes/leaderboard.js`)
   ```javascript
   const express = require('express');
   const router = express.Router();
   const User = require('../models/User');

   // Get top 100 players
   router.get('/top', async (req, res) => {
       try {
           const leaders = await User.find()
               .sort({ rating: -1 })
               .limit(100)
               .select('username rating stats.gamesPlayed stats.gamesWon');
           
           res.json(leaders);
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   // Get user rank
   router.get('/rank/:userId', async (req, res) => {
       try {
           const user = await User.findById(req.params.userId);
           const rank = await User.countDocuments({ rating: { $gt: user.rating } }) + 1;
           
           res.json({ rank, rating: user.rating });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   module.exports = router;
   ```

2. **Update Rating After Game**
   - Implement ELO rating system
   - Update on game completion
   - Emit socket event for real-time updates

#### Friends System

1. **Friend Routes** (`routes/friends.js`)
   ```javascript
   const express = require('express');
   const router = express.Router();
   const User = require('../models/User');
   const { authenticateToken } = require('../middleware/auth');

   // Send friend request
   router.post('/request/:userId', authenticateToken, async (req, res) => {
       try {
           const user = await User.findById(req.userId);
           const friend = await User.findById(req.params.userId);

           if (!friend) {
               return res.status(404).json({ error: 'User not found' });
           }

           if (user.friends.includes(friend._id)) {
               return res.status(400).json({ error: 'Already friends' });
           }

           user.friends.push(friend._id);
           await user.save();

           res.json({ message: 'Friend added successfully' });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   // Get friends list
   router.get('/list', authenticateToken, async (req, res) => {
       try {
           const user = await User.findById(req.userId)
               .populate('friends', 'username rating stats.gamesPlayed');
           
           res.json(user.friends);
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   // Remove friend
   router.delete('/:friendId', authenticateToken, async (req, res) => {
       try {
           const user = await User.findById(req.userId);
           user.friends = user.friends.filter(f => f.toString() !== req.params.friendId);
           await user.save();

           res.json({ message: 'Friend removed' });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });

   module.exports = router;
   ```

---

## 📊 Analytics & Monitoring

### Essential Tools:

1. **Google Analytics**
   - Track user visits, gameplay sessions
   - Understand user behavior
   - Free

2. **Sentry.io**
   - Error tracking and monitoring
   - Get alerts for crashes
   - Free tier: 5,000 events/month

3. **Uptime Monitoring**
   - UptimeRobot (free) - monitors if site is up
   - Alerts via email/SMS if site goes down

---

## 💰 Estimated Monthly Costs

### Minimal Beta Setup (Heroku):
- Domain: $1/month (yearly divided)
- Heroku Hobby: $7/month
- MongoDB Atlas: $0 (free tier)
- **Total: ~$8/month**

### Recommended Production Setup (DigitalOcean):
- Domain: $1/month
- DigitalOcean Droplet: $12/month (2GB)
- MongoDB Atlas: $0 (free tier initially)
- Cloudflare CDN: $0 (free)
- Email Service (SendGrid): $0 (free tier)
- **Total: ~$13/month**

### With Growth (500+ concurrent users):
- Domain: $1/month
- DigitalOcean Droplet: $24/month (4GB)
- MongoDB Atlas: $57/month (M10 dedicated)
- Redis (session store): $15/month
- CDN: $0-20/month
- Email: $15/month
- **Total: ~$112-132/month**

---

## 🔐 Security Checklist

Before going live:

- [ ] Use environment variables for secrets (.env file)
- [ ] Enable HTTPS/SSL on domain
- [ ] Implement rate limiting on API endpoints
- [ ] Add CORS protection
- [ ] Sanitize all user inputs
- [ ] Use helmet.js for security headers
- [ ] Enable database backups (automated)
- [ ] Set up error logging (Sentry)
- [ ] Add CAPTCHA on registration (Google reCAPTCHA)
- [ ] Implement account lockout after failed login attempts

---

## 🎯 Recommended Deployment Timeline

### Week 1: Infrastructure
- Purchase domain
- Set up hosting (Heroku for quick start)
- Configure DNS
- Enable SSL

### Week 2: Authentication
- Implement user registration/login
- Set up MongoDB
- Add email verification
- Test authentication flow

### Week 3: User Profiles & Stats
- Create user profiles
- Implement game statistics tracking
- Build leaderboard

### Week 4: Testing & Polish
- Beta testing with friends
- Fix bugs
- Optimize performance
- Set up monitoring

### Week 5: Soft Launch
- Open beta to small group
- Gather feedback
- Iterate on issues

### Week 6+: Public Launch
- Marketing push
- Social media
- Full public access
- Add friends system
- Add private match invitations

---

## 📝 Next Steps for Development

1. **Create Login/Registration UI**
   - Add modal for login/register
   - Style forms to match your game aesthetic
   - Add form validation

2. **Integrate Auth with Multiplayer**
   - Require login to play multiplayer
   - Show user stats in profile
   - Track game history

3. **Add User Dashboard**
   - Profile page with stats
   - Game history
   - Friends list
   - Leaderboard position

4. **Implement Game History**
   - Save completed games
   - Allow replay viewing
   - Show interesting stats (most used rifts, longest game, etc.)

---

## 🚀 Quick Start Command Summary

```bash
# For Heroku deployment
heroku create rifts-of-chaos
git push heroku main
heroku domains:add riftsofchaos.com

# For DigitalOcean
ssh root@your_ip
apt update && apt upgrade
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs nginx certbot python3-certbot-nginx
git clone your-repo
cd your-repo
npm install
pm2 start server.js
certbot --nginx -d riftsofchaos.com
```

---

## 📞 Support Resources

- **Heroku Docs**: https://devcenter.heroku.com/
- **DigitalOcean Tutorials**: https://www.digitalocean.com/community/tutorials
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com/
- **Passport.js Guide**: http://www.passportjs.org/docs/
- **Socket.io Auth**: https://socket.io/docs/v4/middlewares/

---

**Good luck with your public beta launch! 🎉**

