const express = require('express');
const { google } = require('googleapis');
const User = require('../src/models/User');

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

router.get('/login', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  });
  res.redirect(authUrl); // Automatically redirect user
});


router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error('No authorization code provided');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    req.session.tokens = tokens;
    console.log('Tokens:', tokens);
    const { id_token } = tokens;
    await User.findOneAndUpdate(
      { googleId: id_token },
      { tokens },
      { upsert: true, new: true }
    );

    res.redirect('/');
  } catch (error) {
    console.error('OAuth Error:', error.message);
    res.redirect('/?error=auth_failed');
  }
});

const checkAuth = async (req, res, next) => {
  if (!req.session.tokens) {
    return res.redirect('/?error=unauthorized');
  }

  oauth2Client.setCredentials(req.session.tokens);

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (credentials) {
      req.session.tokens = credentials;
      await User.findOneAndUpdate(
        { googleId: credentials.id_token },
        { tokens: credentials }
      );
    }
    next();
  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.redirect('/?error=auth_expired');
  }
};

module.exports = { router, checkAuth, oauth2Client };