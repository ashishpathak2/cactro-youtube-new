const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const User = require('../src/models/User');

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// 1️⃣ Google Login Route
router.get('/login', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',           // ensures refresh_token is returned
    prompt: 'consent',                // forces consent screen to appear every time
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/userinfo.profile'],
  });
  res.redirect(authUrl);
});

// 2️⃣ Google OAuth Callback Route
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error('No authorization code provided');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 🧠 Get user info from Google
    const { data: userInfo } = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    // Store tokens in session
    req.session.tokens = tokens;
    req.session.googleId = userInfo.id;

    console.log('Tokens:', tokens);

    // Save or update user
    await User.findOneAndUpdate(
      { googleId: userInfo.id },
      {
        googleId: userInfo.id,
        name: userInfo.name,
        tokens,
      },
      { upsert: true, new: true }
    );

    res.redirect('/');
  } catch (error) {
    console.error('OAuth Error:', error.message);
    res.redirect('/?error=auth_failed');
  }
});

// 3️⃣ Middleware: Check Authentication and Refresh Token
const checkAuth = async (req, res, next) => {
  if (!req.session.tokens) {
    return res.redirect('/?error=unauthorized');
  }

  oauth2Client.setCredentials(req.session.tokens);

  try {
    // ⚠️ If no refresh_token, can't refresh access_token
    if (!req.session.tokens.refresh_token) {
      return res.redirect('/?error=auth_expired');
    }

    const { credentials } = await oauth2Client.refreshAccessToken();
    req.session.tokens = {
      ...req.session.tokens,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };

    // Update DB
    if (req.session.googleId) {
      await User.findOneAndUpdate(
        { googleId: req.session.googleId },
        { tokens: req.session.tokens }
      );
    }

    next();
  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.redirect('/?error=auth_expired');
  }
};

module.exports = { router, checkAuth, oauth2Client };
