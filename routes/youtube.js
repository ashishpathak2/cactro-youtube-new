const express = require('express');
const { google } = require('googleapis');
const EventLog = require('../src/models/EventLog');
const Note = require('../src/models/Note');
const { checkAuth, oauth2Client } = require('./auth');

const router = express.Router();

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

const logEvent = async (eventType, details) => {
  try {
    await EventLog.create({ eventType, details });
  } catch (error) {
    console.error('Error logging event:', error.message);
  }
};

router.get('/video/:videoId', checkAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoResponse = await youtube.videos.list({
      part: 'snippet,statistics',
      id: videoId,
    });
    const videoDetails = videoResponse.data.items[0] || null;

    const commentResponse = await youtube.commentThreads.list({
      part: 'snippet',
      videoId,
      maxResults: 20,
    });
    const comments = commentResponse.data.items || [];

    const notes = await Note.find({ videoId });

    await logEvent('VIDEO_FETCH', { videoId });

    res.render('index', {
      isAuthenticated: true,
      videoDetails,
      comments,
      notes,
      videoId,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching video:', error.message);
    await logEvent('VIDEO_FETCH_ERROR', { videoId: req.params.videoId, error: error.message });
    res.render('index', { isAuthenticated: true, videoDetails: null, comments: [], notes: [], videoId: null, error: 'Failed to fetch video' });
  }
});

router.post('/comment/:videoId', checkAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { comment } = req.body;
    const { data } = await youtube.commentThreads.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: comment } },
        },
      },
    });
    await logEvent('COMMENT_ADD', { videoId, comment });
    res.redirect(`/youtube/video/${videoId}`);
  } catch (error) {
    console.error('Error adding comment:', error.message);
    await logEvent('COMMENT_ADD_ERROR', { videoId: req.params.videoId, error: error.message });
    res.redirect(`/youtube/video/${req.params.videoId}?error=comment_failed`);
  }
});

router.post('/comment/reply/:videoId/:commentId', checkAuth, async (req, res) => {
  try {
    const { videoId, commentId } = req.params;
    const { reply } = req.body;
    await youtube.comments.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          parentId: commentId,
          textOriginal: reply,
        },
      },
    });
    await logEvent('COMMENT_REPLY', { videoId, commentId, reply });
    res.redirect(`/youtube/video/${videoId}`);
  } catch (error) {
    console.error('Error adding reply:', error.message);
    await logEvent('COMMENT_REPLY_ERROR', { videoId: req.params.videoId, commentId, error: error.message });
    res.redirect(`/youtube/video/${req.params.videoId}?error=reply_failed`);
  }
});

router.post('/comment/delete/:videoId/:commentId', checkAuth, async (req, res) => {
  try {
    const { videoId, commentId } = req.params;
    await youtube.comments.delete({ id: commentId });
    await logEvent('COMMENT_DELETE', { commentId });
    res.redirect(`/youtube/video/${videoId}`);
  } catch (error) {
    console.error('Error deleting comment:', error.message);
    await logEvent('COMMENT_DELETE_ERROR', { commentId, error: error.message });
    res.redirect(`/youtube/video/${req.params.videoId}?error=delete_comment_failed`);
  }
});

router.post('/video/update/:videoId', checkAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { title, description } = req.body;

    const videoResponse = await youtube.videos.list({
      part: 'snippet',
      id: videoId,
    });
    const currentSnippet = videoResponse.data.items[0].snippet;

    await youtube.videos.update({
      part: 'snippet',
      requestBody: {
        id: videoId,
        snippet: {
          title: title || currentSnippet.title,
          description: description || currentSnippet.description,
          categoryId: currentSnippet.categoryId || '22',
        },
      },
    });
    await logEvent('VIDEO_UPDATE', { videoId, title, description });
    res.redirect(`/youtube/video/${videoId}`);
  } catch (error) {
    console.error('Error updating video:', error.message);
    await logEvent('VIDEO_UPDATE_ERROR', { videoId: req.params.videoId, error: error.message });
    res.redirect(`/youtube/video/${req.params.videoId}?error=update_failed`);
  }
});

router.post('/note/:videoId', checkAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { content, tags } = req.body;
    const note = await Note.create({
      videoId,
      content,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
    });
    await logEvent('NOTE_ADD', { videoId, content, tags });
    res.redirect(`/youtube/video/${videoId}`);
  } catch (error) {
    console.error('Error saving note:', error.message);
    await logEvent('NOTE_ADD_ERROR', { videoId: req.params.videoId, error: error.message });
    res.redirect(`/youtube/video/${req.params.videoId}?error=note_failed`);
  }
});

router.post('/note/search/:videoId', checkAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { tag } = req.body;

    const videoResponse = await youtube.videos.list({
      part: 'snippet,statistics',
      id: videoId,
    });
    const videoDetails = videoResponse.data.items[0] || null;

    const commentResponse = await youtube.commentThreads.list({
      part: 'snippet',
      videoId,
      maxResults: 20,
    });
    const comments = commentResponse.data.items || [];

    const notes = tag ? await Note.find({ videoId, tags: tag }) : await Note.find({ videoId });

    await logEvent('NOTE_SEARCH', { videoId, tag });

    res.render('index', {
      isAuthenticated: true,
      videoDetails,
      comments,
      notes,
      videoId,
      error: null,
    });
  } catch (error) {
    console.error('Error searching notes:', error.message);
    await logEvent('NOTE_SEARCH_ERROR', { videoId: req.params.videoId, error: error.message });
    res.redirect(`/youtube/video/${req.params.videoId}?error=search_failed`);
  }
});

module.exports = router;