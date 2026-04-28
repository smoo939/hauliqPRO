import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import HauliqLogo from '@/components/shared/HauliqLogo';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = 'April 27, 2026';

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary shadow-soft hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary p-1">
              <HauliqLogo variant="light" size={28} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">Privacy Policy</h1>
              <p className="text-[11px] text-muted-foreground">Last updated {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <section className="rounded-3xl bg-card shadow-soft p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-black">Your privacy at Hauliq</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Hauliq is a Zimbabwean freight marketplace that connects shippers with carriers. This policy
            explains, in plain language, what we collect, why we collect it, who we share it with, and the
            choices you have. By creating an account or using the app, you agree to this policy.
          </p>
        </section>

        <Block title="1. Information we collect">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account details:</strong> name, email, phone number, country, city, home address, and password.</li>
            <li><strong>Role-specific details:</strong> for carriers — company name, truck type, number plate, capacity. For shippers — load details such as origin, destination, cargo type and photos.</li>
            <li><strong>Verification documents:</strong> ID, driving licence, vehicle registration and insurance — only when you choose to verify.</li>
            <li><strong>Activity:</strong> loads posted, bids placed, messages exchanged, ratings, and completed jobs.</li>
            <li><strong>Device data:</strong> basic technical information needed to deliver the service (browser type, IP, error logs).</li>
            <li><strong>Optional location:</strong> only if you grant permission, used to surface nearby loads or trucks.</li>
          </ul>
        </Block>

        <Block title="2. How we use your information">
          <ul className="list-disc pl-5 space-y-2">
            <li>To create and operate your account and match shippers with carriers.</li>
            <li>To facilitate bidding, communication, payments, and dispute resolution.</li>
            <li>To verify identities and prevent fraud, scams, and unsafe activity.</li>
            <li>To improve the app, including AI-assisted features that help you write listings and bids.</li>
            <li>To send important notifications about your loads, bids, and account.</li>
          </ul>
        </Block>

        <Block title="3. AI features">
          <p>
            Hauliq uses Google Gemini through Replit's AI integration to power features like the AI Write
            description helper and the in-app assistant. The text you submit to these features is sent to
            Google for processing and is not used to train public models.
          </p>
        </Block>

        <Block title="4. Sharing your information">
          <p>We never sell your personal data. We share only what is necessary, with:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>Other Hauliq users</strong> when you post a load, place a bid, or message someone.</li>
            <li><strong>Service providers</strong> that help us run the platform (hosting on Replit, database, AI processing, payment partners) under strict agreements.</li>
            <li><strong>Authorities</strong> when required by Zimbabwean law or to protect users from harm.</li>
          </ul>
        </Block>

        <Block title="5. How long we keep your data">
          <p>
            We keep your account data for as long as your account is active. You can request deletion at any
            time. Some records (e.g. completed loads, payments, dispute history) may be retained for a limited
            period to comply with legal, accounting and safety obligations.
          </p>
        </Block>

        <Block title="6. Your rights">
          <ul className="list-disc pl-5 space-y-2">
            <li>Access, correct or update your information from your profile.</li>
            <li>Withdraw consent for optional permissions (e.g. location, notifications) at any time.</li>
            <li>Request a copy of your data or ask for your account to be deleted.</li>
            <li>Opt out of non-essential communications.</li>
          </ul>
        </Block>

        <Block title="7. Security">
          <p>
            Passwords are stored as one-way hashes. Connections to Hauliq use HTTPS. We restrict internal
            access to your data on a need-to-know basis. No system is perfectly secure, so please use a strong
            unique password and keep your device safe.
          </p>
        </Block>

        <Block title="8. Children">
          <p>Hauliq is intended for users aged 18 and over. We do not knowingly collect data from children.</p>
        </Block>

        <Block title="9. Changes to this policy">
          <p>
            If we make material changes we will notify you in the app and update the "Last updated" date above.
            Continued use after a change means you accept the updated policy.
          </p>
        </Block>

        <Block title="10. Contact us">
          <p>
            Questions, requests or complaints? Email <a href="mailto:privacy@hauliq.co.zw" className="font-bold text-primary hover:underline">privacy@hauliq.co.zw</a>.
          </p>
        </Block>

        <div className="pt-4 pb-8 text-center">
          <button
            onClick={() => navigate(-1)}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground glow-amber"
          >
            Back to app
          </button>
        </div>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card shadow-soft p-6">
      <h3 className="mb-2 text-base font-black tracking-tight">{title}</h3>
      <div className="text-sm leading-relaxed text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}
