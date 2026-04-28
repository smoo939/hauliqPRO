import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import HauliqLogo from '@/components/shared/HauliqLogo';

export default function TermsPage() {
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
              <h1 className="text-base font-black tracking-tight">Terms and Conditions</h1>
              <p className="text-[11px] text-muted-foreground">Last updated {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <section className="rounded-3xl bg-card shadow-soft p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-black">Welcome to Hauliq</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These Terms govern your use of the Hauliq freight marketplace. By creating an account or using the
            app you agree to be bound by them.
          </p>
        </section>

        <Block title="1. Who we are">
          <p>
            Hauliq is a marketplace that connects shippers (people who need cargo moved) with carriers
            (transport operators) in Zimbabwe and the surrounding region. Hauliq is not a transport company,
            employer or insurer — we facilitate the connection, but the haulage contract is between the
            shipper and the carrier.
          </p>
        </Block>

        <Block title="2. Eligibility">
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be 18 years or older.</li>
            <li>You must provide accurate information about yourself, your business and your equipment.</li>
            <li>Carriers must hold a valid driving licence and lawful right to operate the vehicle.</li>
          </ul>
        </Block>

        <Block title="3. Account responsibilities">
          <ul className="list-disc pl-5 space-y-2">
            <li>Keep your password confidential. You are responsible for activity under your account.</li>
            <li>Do not impersonate others or create duplicate accounts.</li>
            <li>Report unauthorised access immediately to support@hauliq.co.zw.</li>
          </ul>
        </Block>

        <Block title="4. Posting loads and placing bids">
          <ul className="list-disc pl-5 space-y-2">
            <li>Shippers must describe loads accurately, including weight, dimensions and any hazards.</li>
            <li>Carriers must only bid on loads they are legally and operationally able to carry.</li>
            <li>Once a bid is accepted, both parties are expected to honour the agreed terms.</li>
          </ul>
        </Block>

        <Block title="5. Payments">
          <p>
            Payments may be made through the app (where available) or directly between shipper and carrier.
            When made through the app, Hauliq may charge a service fee disclosed at the time of payment.
            Hauliq is not responsible for payments made off-platform.
          </p>
        </Block>

        <Block title="6. Verification">
          <p>
            Verified status is awarded after we review submitted documents. Verification helps build trust but
            does not guarantee performance. You remain responsible for your own due diligence.
          </p>
        </Block>

        <Block title="7. Prohibited conduct">
          <ul className="list-disc pl-5 space-y-2">
            <li>No fraud, scams, fake bids or misrepresentation of cargo or vehicles.</li>
            <li>No transport of illegal goods or anything that breaches Zimbabwean law.</li>
            <li>No harassment, hate speech or unsafe behaviour towards other users.</li>
            <li>No scraping, reverse engineering or interfering with the service.</li>
          </ul>
        </Block>

        <Block title="8. Disputes">
          <p>
            Try to resolve disagreements with the other party first. If you cannot, you may raise a dispute in
            the app. Hauliq may, at its discretion, mediate, but the underlying contract remains between
            shipper and carrier.
          </p>
        </Block>

        <Block title="9. Liability">
          <p>
            Hauliq provides the platform "as is". To the maximum extent permitted by law, we are not liable
            for losses arising from the conduct of other users, lost or damaged cargo, missed deliveries or
            third-party services such as payment providers.
          </p>
        </Block>

        <Block title="10. Suspension and termination">
          <p>
            We may suspend or close accounts that breach these Terms or put other users at risk. You may close
            your account at any time from your profile.
          </p>
        </Block>

        <Block title="11. Changes">
          <p>
            We may update these Terms. Material changes will be highlighted in the app. Continued use means
            you accept the updated Terms.
          </p>
        </Block>

        <Block title="12. Governing law">
          <p>
            These Terms are governed by the laws of Zimbabwe. Disputes will be handled by the competent courts
            of Zimbabwe unless otherwise required by mandatory law.
          </p>
        </Block>

        <Block title="13. Contact">
          <p>
            Questions? Email <a href="mailto:support@hauliq.co.zw" className="font-bold text-primary hover:underline">support@hauliq.co.zw</a>.
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
