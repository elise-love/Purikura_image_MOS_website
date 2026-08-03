const SPREADSHEET_ID = '1WcuSL8BdkvD-x56iwBQK1Tyo4dsOi74wXpUF3qnufLI';
const PARTICIPANTS_SHEET_NAME = 'MOS_participants';
const RATINGS_SHEET_NAME = 'MOS_ratings';

const EXPECTED_RATING_COUNT = 30;
const REPEAT_PAIRS = [
  ['P-257', 'P-201'],
  ['P-227', 'P-283'],
  ['P-243', 'P-293'],
];

const PARTICIPANT_HEADERS = [
  'submission_id', 'study_id', 'participant_id', 'sequence_version',
  'started_at', 'completed_at', 'duration_sec',
  'photobooth_frequency', 'imaging_background', 'device', 'light',
  'rating_count', 'unique_display_count', 'mean_appeal', 'mean_naturalness',
  'mean_response_ms', 'repeat_mae_appeal', 'repeat_mae_naturalness', 'data_status'
];

const RATING_HEADERS = [
  'submission_id', 'study_id', 'participant_id', 'sequence_version',
  'order', 'display_id', 'appeal', 'naturalness', 'response_ms', 'attention_check'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Missing POST body.');
    }

    const payload = JSON.parse(e.postData.contents);
    const ratings = Array.isArray(payload.ratings) ? payload.ratings : [];
    if (ratings.length === 0) {
      throw new Error('No ratings were received.');
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const participantSheet = ensureSheet_(spreadsheet, PARTICIPANTS_SHEET_NAME, PARTICIPANT_HEADERS);
    const ratingSheet = ensureSheet_(spreadsheet, RATINGS_SHEET_NAME, RATING_HEADERS);

    const submissionId = Utilities.getUuid();
    const background = payload.background || {};
    const uniqueDisplayCount = new Set(ratings.map(function (rating) {
      return rating.displayId;
    })).size;

    const ratingRows = ratings.map(function (rating) {
      return [
        submissionId,
        payload.studyId || '',
        payload.participantId || '',
        payload.sequenceVersion || '',
        numberOrBlank_(rating.order),
        rating.displayId || '',
        numberOrBlank_(rating.appeal),
        numberOrBlank_(rating.naturalness),
        numberOrBlank_(rating.responseMs),
        rating.attentionCheck === true
      ];
    });

    const isComplete = ratings.length === EXPECTED_RATING_COUNT
      && uniqueDisplayCount === EXPECTED_RATING_COUNT;

    const participantRow = [[
      submissionId,
      payload.studyId || '',
      payload.participantId || '',
      payload.sequenceVersion || '',
      payload.startedAt || '',
      payload.completedAt || '',
      numberOrBlank_(payload.durationSec),
      background.photoboothFrequency || '',
      background.imagingBackground || '',
      background.device || '',
      background.light || '',
      ratings.length,
      uniqueDisplayCount,
      mean_(ratings, 'appeal', 3),
      mean_(ratings, 'naturalness', 3),
      mean_(ratings, 'responseMs', 0),
      repeatMae_(ratings, 'appeal'),
      repeatMae_(ratings, 'naturalness'),
      isComplete ? 'COMPLETE' : 'CHECK'
    ]];

    // Always preserve the item-level raw data. The participant summary is then
    // written as one readable row linked by the same submission_id.
    appendRows_(ratingSheet, ratingRows);
    appendRows_(participantSheet, participantRow);

    return jsonResponse_({
      ok: true,
      submissionId: submissionId,
      participantRowsAdded: 1,
      ratingRowsAdded: ratingRows.length
    });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Photo Booth MOS receiver is online. Using MOS_participants + MOS_ratings.')
    .setMimeType(ContentService.MimeType.TEXT);
}

// Run this once from the Apps Script editor if you want to create both sheets
// before conducting a test submission.
function setupSheets() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(spreadsheet, PARTICIPANTS_SHEET_NAME, PARTICIPANT_HEADERS);
  ensureSheet_(spreadsheet, RATINGS_SHEET_NAME, RATING_HEADERS);
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  for (let index = 0; index < headers.length; index += 1) {
    if (existingHeaders[index] !== headers[index]) {
      throw new Error('Header mismatch in sheet "' + name + '" at column ' + (index + 1) + '.');
    }
  }

  return sheet;
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function mean_(ratings, field, decimals) {
  const values = ratings
    .map(function (rating) { return Number(rating[field]); })
    .filter(function (value) { return Number.isFinite(value); });

  if (!values.length) return '';
  const value = values.reduce(function (sum, item) { return sum + item; }, 0) / values.length;
  return round_(value, decimals);
}

function repeatMae_(ratings, field) {
  const byDisplayId = {};
  ratings.forEach(function (rating) {
    const value = Number(rating[field]);
    if (rating.displayId && Number.isFinite(value)) {
      byDisplayId[rating.displayId] = value;
    }
  });

  const differences = REPEAT_PAIRS.map(function (pair) {
    const original = byDisplayId[pair[0]];
    const repeated = byDisplayId[pair[1]];
    return Number.isFinite(original) && Number.isFinite(repeated)
      ? Math.abs(original - repeated)
      : null;
  }).filter(function (value) { return value !== null; });

  if (differences.length !== REPEAT_PAIRS.length) return '';
  const mae = differences.reduce(function (sum, value) { return sum + value; }, 0) / differences.length;
  return round_(mae, 3);
}

function numberOrBlank_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function round_(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
