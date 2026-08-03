import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildRandomizedSequence } from "./sequence";

declare global {
  interface Window {
    MOS_CONFIG?: {
      endpoint?: string;
      studyId?: string;
      allowOfflineExport?: boolean;
    };
  }
}

type Page = "welcome" | "background" | "instructions" | "rating" | "done" | "declined";
type SequenceVersion = string;

type Background = {
  photoboothFrequency: string;
  imagingBackground: string;
  device: string;
  light: string;
};

type Rating = {
  order: number;
  displayId: string;
  appeal: number;
  naturalness: number;
  responseMs: number;
  attentionCheck: boolean;
};

type Draft = {
  participantId: string;
  sequenceVersion: SequenceVersion;
  startedAt: string;
  page: "background" | "instructions" | "rating";
  background: Background;
  ratings: Rating[];
  sequence: string[];
  currentIndex: number;
};

type Payload = Draft & {
  schemaVersion: "1.0";
  studyId: string;
  completedAt: string;
  durationSec: number;
  consent: true;
};

const STORAGE_KEY = "photobooth-mos-draft-v3";
const EMPTY_BACKGROUND: Background = {
  photoboothFrequency: "",
  imagingBackground: "",
  device: "",
  light: "",
};

const CONFIG = {
  endpoint: window.MOS_CONFIG?.endpoint?.trim() ?? "",
  studyId: window.MOS_CONFIG?.studyId ?? "photobooth-mos-2026",
  allowOfflineExport: window.MOS_CONFIG?.allowOfflineExport ?? true,
};

function makeParticipantId() {
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `MOS-${token}`;
}

function saveDraft(draft: Draft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

function loadDraft(): Draft | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as Draft) : null;
  } catch {
    return null;
  }
}

function downloadPayload(payload: Payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${payload.participantId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Header({ page }: { page: Page }) {
  return (
    <header className="site-header">
      <a className="brand" href="./" aria-label="照片品質感受調查首頁">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><b>MOS</b><small>PHOTO BOOTH STUDY</small></span>
      </a>
      {page === "rating" && <span className="study-tag">匿名研究</span>}
    </header>
  );
}

function ChoiceGroup({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map((option) => (
          <label className={value === option ? "choice selected" : "choice"} key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              required
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RatingScale({
  name,
  prompt,
  hint,
  low,
  high,
  value,
  onChange,
}: {
  name: string;
  prompt: string;
  hint?: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rating-scale" role="group" aria-labelledby={`${name}-prompt`}>
      <p className="rating-prompt" id={`${name}-prompt`}>{prompt}</p>
      {hint && <p className="rating-hint">{hint}</p>}
      <div className="scale-labels" aria-hidden="true"><span>{low}</span><span>{high}</span></div>
      <div className="scale-options">
        {[1, 2, 3, 4, 5].map((score) => (
          <label className={value === score ? "score selected" : "score"} key={score}>
            <input
              type="radio"
              name={name}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              required
            />
            <b>{score}</b>
            <small>{score === 1 ? low : score === 5 ? high : score === 3 ? "普通" : ""}</small>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const saved = useMemo(loadDraft, []);
  const [page, setPage] = useState<Page>("welcome");
  const [consent, setConsent] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [sequenceVersion, setSequenceVersion] = useState<SequenceVersion>("R1");
  const [sequence, setSequence] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [background, setBackground] = useState<Background>(EMPTY_BACKGROUND);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [appeal, setAppeal] = useState<number | null>(null);
  const [naturalness, setNaturalness] = useState<number | null>(null);
  const [itemStartedAt, setItemStartedAt] = useState(Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "offline" | "error">("idle");
  const [finalPayload, setFinalPayload] = useState<Payload | null>(null);

  const displayId = sequence[currentIndex];

  useEffect(() => {
    if (page !== "rating") return;
    setItemStartedAt(Date.now());
    const nextId = sequence[currentIndex + 1];
    if (nextId) {
      const preload = new Image();
      preload.src = `${import.meta.env.BASE_URL}stimuli/${nextId}.png`;
    }
  }, [currentIndex, page, sequence]);

  function newSession() {
    const id = makeParticipantId();
    const randomized = buildRandomizedSequence(id);
    const now = new Date().toISOString();
    setParticipantId(id);
    setSequenceVersion(randomized.sequenceVersion);
    setSequence(randomized.sequence);
    setStartedAt(now);
    setBackground(EMPTY_BACKGROUND);
    setRatings([]);
    setCurrentIndex(0);
    saveDraft({
      participantId: id,
      sequenceVersion: randomized.sequenceVersion,
      startedAt: now,
      page: "background",
      background: EMPTY_BACKGROUND,
      ratings: [],
      sequence: randomized.sequence,
      currentIndex: 0,
    });
    setPage("background");
  }

  function handleConsent(event: FormEvent) {
    event.preventDefault();
    if (consent === "agree") newSession();
    if (consent === "decline") setPage("declined");
  }

  function resumeSession() {
    const draft = loadDraft();
    if (!draft) return;
    setParticipantId(draft.participantId);
    setSequenceVersion(draft.sequenceVersion);
    setSequence(draft.sequence);
    setStartedAt(draft.startedAt);
    setBackground(draft.background);
    setRatings(draft.ratings);
    setCurrentIndex(draft.currentIndex);
    setPage(draft.page);
  }

  function submitBackground(event: FormEvent) {
    event.preventDefault();
    saveDraft({ participantId, sequenceVersion, startedAt, page: "instructions", background, ratings, sequence, currentIndex });
    setPage("instructions");
  }

  function startRating() {
    saveDraft({ participantId, sequenceVersion, startedAt, page: "rating", background, ratings, sequence, currentIndex });
    setPage("rating");
  }

  async function finishStudy(allRatings: Rating[]) {
    const completedAt = new Date().toISOString();
    const payload: Payload = {
      schemaVersion: "1.0",
      studyId: CONFIG.studyId,
      participantId,
      sequenceVersion,
      startedAt,
      completedAt,
      durationSec: Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000),
      consent: true,
      page: "rating",
      background,
      ratings: allRatings,
      sequence,
      currentIndex: allRatings.length,
    };
    setFinalPayload(payload);
    setPage("done");

    if (!CONFIG.endpoint) {
      setStatus("offline");
      if (CONFIG.allowOfflineExport) downloadPayload(payload);
      return;
    }

    setStatus("sending");
    try {
      await fetch(CONFIG.endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      localStorage.removeItem(STORAGE_KEY);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  function submitRating(event: FormEvent) {
    event.preventDefault();
    if (appeal === null || naturalness === null) return;
    const nextRatings = [
      ...ratings,
      {
        order: currentIndex + 1,
        displayId,
        appeal,
        naturalness,
        responseMs: Date.now() - itemStartedAt,
        attentionCheck: false,
      },
    ];
    setRatings(nextRatings);
    setAppeal(null);
    setNaturalness(null);

    if (currentIndex === sequence.length - 1) {
      void finishStudy(nextRatings);
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    saveDraft({
      participantId,
      sequenceVersion,
      startedAt,
      page: "rating",
      background,
      ratings: nextRatings,
      sequence,
      currentIndex: nextIndex,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <Header page={page} />
      <main>
        {page === "welcome" && (
          <section className="welcome panel">
            <div className="eyebrow">MMAsia 2026 · USER STUDY</div>
            <h1>照片品質<br /><em>感受調查</em></h1>
            <p className="lead">看一組 Photo Booth 紀念照片，憑第一直覺告訴我們：你喜歡它嗎？它看起來自然嗎？</p>
            <div className="facts" aria-label="調查資訊">
              <span><b>30</b><small>個評分畫面</small></span>
              <span><b>1–5</b><small>分直覺評分</small></span>
              <span><b>12–15</b><small>分鐘完成</small></span>
            </div>
            <form onSubmit={handleConsent} className="consent-card">
              <h2>參與同意</h2>
              <p>本調查為學術研究用途，僅蒐集匿名評分與少數背景資料，不會蒐集可辨識個人身分的資訊。結果僅以彙總形式呈現，你可隨時關閉頁面停止參與。</p>
              <label className={consent === "agree" ? "consent-option selected" : "consent-option"}>
                <input type="radio" name="consent" value="agree" checked={consent === "agree"} onChange={(event) => setConsent(event.target.value)} required />
                <span><b>我同意並開始</b><small>我已閱讀並同意上述條件</small></span>
              </label>
              <label className={consent === "decline" ? "consent-option selected" : "consent-option"}>
                <input type="radio" name="consent" value="decline" checked={consent === "decline"} onChange={(event) => setConsent(event.target.value)} required />
                <span><b>我不同意</b><small>結束本次填答</small></span>
              </label>
              <button className="primary-button" type="submit" disabled={!consent}>繼續 <span aria-hidden="true">→</span></button>
              {saved && <button className="text-button" type="button" onClick={resumeSession}>繼續上次未完成的填答</button>}
            </form>
          </section>
        )}

        {page === "background" && (
          <section className="form-page panel compact-panel">
            <div className="step-kicker">開始前 · 4 個小問題</div>
            <h1>你的使用情境</h1>
            <p className="section-intro">只作分群分析，不會用來辨識你的身分。</p>
            <form onSubmit={submitBackground}>
              <ChoiceGroup name="frequency" label="你多常使用大頭貼機 / photobooth？" value={background.photoboothFrequency} options={["從未", "很少", "偶爾", "經常"]} onChange={(value) => setBackground({ ...background, photoboothFrequency: value })} />
              <ChoiceGroup name="background" label="你是否有攝影、影像或設計相關背景？" value={background.imagingBackground} options={["完全沒有", "業餘愛好", "專業或就學相關"]} onChange={(value) => setBackground({ ...background, imagingBackground: value })} />
              <ChoiceGroup name="device" label="你目前用哪種裝置填答？" value={background.device} options={["手機", "平板", "筆電", "桌上型電腦"]} onChange={(value) => setBackground({ ...background, device: value })} />
              <ChoiceGroup name="light" label="你現在的環境光線？" value={background.light} options={["偏暗", "一般室內", "明亮或戶外"]} onChange={(value) => setBackground({ ...background, light: value })} />
              <button className="primary-button" type="submit">下一步 <span aria-hidden="true">→</span></button>
            </form>
          </section>
        )}

        {page === "instructions" && (
          <section className="instructions panel compact-panel">
            <div className="step-kicker">評分方式</div>
            <h1>每張照片，回答兩題</h1>
            <div className="instruction-card appeal-card">
              <span>01</span><div><h2>整體喜歡度</h2><p>把照片當成一份現場紀念成品，<b>包含它的外框</b>，你整體有多喜歡？</p></div>
            </div>
            <div className="instruction-card natural-card">
              <span>02</span><div><h2>影像自然度</h2><p><b>請忽略人物本身的動作、表情、姿勢、服裝與造型，也忽略裝飾外框</b>，只評估影像處理後的畫面是否自然。請觀察整體明暗與曝光是否合理（有沒有過亮或過暗）、色彩是否過度飽和、膚色是否自然，以及是否有銳化過頭、邊緣不自然或其他明顯的影像處理痕跡。</p></div>
            </div>
            <div className="scale-demo"><span>1<br /><small>最低</small></span><i /><span>2</span><i /><span>3<br /><small>普通</small></span><i /><span>4</span><i /><span>5<br /><small>最高</small></span></div>
            <aside className="study-note"><b>請依第一直覺作答</b><p>不要回頭比較，也沒有標準答案。整份問卷請維持同一台裝置、相同螢幕亮度與瀏覽器縮放比例。</p></aside>
            <button className="primary-button" type="button" onClick={startRating}>開始評分 <span aria-hidden="true">→</span></button>
          </section>
        )}

        {page === "rating" && (
          <section className="rating-page">
            <div className="progress-row">
              <div><span>評分進度</span><b>{currentIndex + 1} / {sequence.length}</b></div>
              <div className="progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={sequence.length} aria-valuenow={currentIndex + 1}><i style={{ width: `${((currentIndex + 1) / sequence.length) * 100}%` }} /></div>
            </div>
            <div className="photo-panel">
              <div className="photo-heading"><span>PHOTO</span><h1>照片 {displayId}</h1></div>
              <div className="image-stage"><img src={`${import.meta.env.BASE_URL}stimuli/${displayId}.png`} alt={`評分照片 ${displayId}`} draggable="false" /></div>
            </div>
            <form onSubmit={submitRating} className="ratings-panel">
              <RatingScale name={`appeal-${currentIndex}`} prompt="你整體有多喜歡這張照片？（把它當成一份含外框的現場紀念成品）" low="非常不喜歡" high="非常喜歡" value={appeal} onChange={setAppeal} />
              <RatingScale
                name={`naturalness-${currentIndex}`}
                prompt="忽略人物的動作、表情、姿勢、服裝與造型，以及裝飾外框；只評估影像處理後的整體自然度。"
                hint="請留意明暗與曝光（過亮或過暗）、色彩飽和度、膚色、銳化程度，以及是否有不自然的邊緣或其他處理痕跡。"
                low="非常不自然"
                high="非常自然"
                value={naturalness}
                onChange={setNaturalness}
              />
              <button className="primary-button" type="submit" disabled={appeal === null || naturalness === null}>{currentIndex === sequence.length - 1 ? "送出評分" : "下一張"} <span aria-hidden="true">→</span></button>
              <p className="autosave">已自動儲存目前進度</p>
            </form>
          </section>
        )}

        {page === "done" && (
          <section className="finish panel compact-panel">
            <div className="success-mark" aria-hidden="true">✓</div>
            <div className="eyebrow">COMPLETED</div>
            <h1>謝謝你完成調查！</h1>
            {status === "sending" && <p className="lead">正在安全送出你的匿名評分…</p>}
            {status === "sent" && <p className="lead">你的匿名評分已成功送出。每一個回答都會直接幫助我們改善現場拍照的成像品質。</p>}
            {status === "offline" && <div className="status-warning"><b>研究者尚未設定資料接收網址</b><p>這次結果已下載為備份檔，請交給研究者。正式發放前，請依 README 完成 Google 試算表連線。</p></div>}
            {status === "error" && <div className="status-warning"><b>網路送出失敗</b><p>請保留此頁並再試一次，或下載匿名資料備份交給研究者。</p></div>}
            {(status === "error" || status === "offline") && finalPayload && CONFIG.allowOfflineExport && <button className="secondary-button" type="button" onClick={() => downloadPayload(finalPayload)}>下載匿名資料備份</button>}
            <div className="participant-code"><small>匿名填答代碼</small><b>{participantId}</b></div>
          </section>
        )}

        {page === "declined" && (
          <section className="finish panel compact-panel">
            <div className="eyebrow">已結束</div><h1>謝謝你的時間</h1><p className="lead">你選擇不參與，本頁不會送出或保留任何評分資料，現在可以安全關閉。</p>
          </section>
        )}
      </main>
      <footer><span>Real-Time Adaptive Image Enhancer Photo Booth</span><span>匿名 · 雙盲 · 學術研究</span></footer>
    </div>
  );
}
