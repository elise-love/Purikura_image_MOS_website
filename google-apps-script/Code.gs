const SHEET_NAME = 'MOS_responses';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    const headers = [
      'submission_id', 'study_id', 'participant_id', 'sequence_version',
      'started_at', 'completed_at', 'duration_sec',
      'photobooth_frequency', 'imaging_background', 'device', 'light',
      'order', 'display_id', 'appeal', 'naturalness', 'response_ms', 'attention_check'
    ];

    if (sheet.getLastRow() === 0) sheet.appendRow(headers);

    const submissionId = Utilities.getUuid();
    const b = payload.background || {};
    const rows = (payload.ratings || []).map((rating) => [
      submissionId, payload.studyId, payload.participantId, payload.sequenceVersion,
      payload.startedAt, payload.completedAt, payload.durationSec,
      b.photoboothFrequency, b.imagingBackground, b.device, b.light,
      rating.order, rating.displayId, rating.appeal, rating.naturalness,
      rating.responseMs, rating.attentionCheck
    ]);

    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, submissionId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Photo Booth MOS receiver is online.');
}
