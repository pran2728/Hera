import { Logo } from '../App.jsx'

// Hera's privacy policy, in plain English. Public at /?privacy.
export const PRIVACY_UPDATED = '10 October 2026'

export default function Privacy({ onBack }) {
  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={onBack} aria-label="Back">← Back</button>
        <span className="topbar-title">Privacy</span>
        <span style={{ width: 64 }} />
      </header>
      <main className="cycle-page policy">
        <section className="card">
          <div className="policy-head"><Logo size={40} /><div><h2>How Hera handles your data</h2><p className="muted small">Last updated {PRIVACY_UPDATED}. Hera is in beta.</p></div></div>
          <p>Hera is a small, independent project, not a company or a medical service. This page says exactly what happens to what you tell her.</p>
        </section>

        <section className="card">
          <h2>What Hera saves</h2>
          <ul>
            <li>Your email and password (the password is stored scrambled, so nobody can read it).</li>
            <li>Your answers from sign-up and My profile: name, age, life stage, cycle details, diet, conditions, reminder settings.</li>
            <li>Your chats with Hera, and what she logs from them (period dates, pain, mood, symptoms).</li>
            <li>Your partner link and trusted contact, if you add them.</li>
            <li>Which of your devices get notifications, and any feedback you send.</li>
          </ul>
          <p>It is used only to reply to you, predict your cycle and send your reminders. No ads. Never sold.</p>
        </section>

        <section className="card">
          <h2>Where it lives</h2>
          <p>Your data is stored with <strong>Supabase</strong> (database and login). The app itself is hosted on <strong>Vercel</strong>. Database rules make sure each account can only ever read its own data.</p>
          <p>The person who runs Hera can access the database to keep it working, and will only look at it to fix a problem you report.</p>
        </section>

        <section className="card warn">
          <h2>The AI: please read</h2>
          <p>To write a reply, Hera sends your message, recent chat and profile details to <strong>Google's Gemini AI</strong>. During this beta Hera uses Google's free tier, where <strong>Google may use what you send to improve its products, and people at Google may read it</strong>.</p>
          <p><strong>So for now, please use made-up details, not your real health information.</strong> This will change before Hera opens to the public.</p>
        </section>

        <section className="card">
          <h2>Your partner</h2>
          <p>If you invite a partner, they see only your current phase, a tip, your next likely period (if you allow it) and the nudges you switch on. Never your chats, logs or symptoms, and never that your period is late, that you're pregnant or that you're in menopause. You can disconnect them at any time.</p>
        </section>

        <section className="card">
          <h2>If you're not okay</h2>
          <p>If you tell Hera you're in distress, she shows helplines (Tele-MANAS 14416, 112) and a button to message your trusted contact. If you turned on crisis alerts for your partner, they get "please check on her", never what you said.</p>
        </section>

        <section className="card">
          <h2>Your controls</h2>
          <ul>
            <li><strong>See and delete logs</strong> any time in My cycle.</li>
            <li><strong>Download all your data</strong> from My profile → Your data.</li>
            <li><strong>Delete your account</strong> from My profile → Your data. Your login and everything above are erased from Hera right away and can't be recovered. (Google may keep what it already received under its own terms.)</li>
            <li><strong>Turn off reminders</strong> or pause them for a week.</li>
          </ul>
        </section>

        <section className="card">
          <h2>The small print</h2>
          <ul>
            <li>Hera is for adults (18+).</li>
            <li>Hera gives general guidance, not medical advice or diagnosis. For anything worrying, see a doctor.</li>
            <li>Cycle and fertile-window predictions are estimates and must never be used as contraception.</li>
            <li>If this policy changes, Hera will tell you in the app.</li>
          </ul>
          <p>Questions? Use <strong>Send feedback</strong> in My profile.</p>
        </section>
      </main>
    </div>
  )
}
