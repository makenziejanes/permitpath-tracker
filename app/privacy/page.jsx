import '../book/book.css';

export const metadata = {
  title: 'Privacy · PermitPath',
  description: 'How PermitPath handles information from its booking page.',
};

export default function Privacy() {
  return (
    <div className="bk-page">
    <main className="bk bk-narrow">
      <header className="bk-head">
        <a href="/book" className="bk-logo"><img src="/permitpath-logo.png" alt="PermitPath" width="816" height="208" /></a>
        <h1>Privacy</h1>
      </header>
      <div className="bk-card">
        <p className="bk-muted">Last updated October 31, 2026</p>
        <h2>Booking page</h2>
        <p>When you book a meeting at team.permitpathcities.com/book, we collect your name, job title (if you give one), city, state, work email, and anything you write about what you’d like to discuss.</p>
        <p>We use this only to schedule and hold the meeting: it goes into a Google Calendar invite sent to you, Makenzie, and Collin. We also check whether the email address belongs to a city government so we can spot spam. We don’t sell or share it with anyone else.</p>
        <h2>Google Calendar</h2>
        <p>Makenzie and Collin connect their own Google Calendars so the booking page can see when they’re busy and add meetings. The app only reads busy times and creates the meetings booked through this page. It does not read the details of other events, and Google data is never shared with or sold to anyone. Our use of Google data follows the Google API Services User Data Policy, including its Limited Use requirements.</p>
        <h2>Questions or deletion</h2>
        <p>Email <a href="mailto:makenzie@permitpathcities.com">makenzie@permitpathcities.com</a> and we’ll answer or delete your information.</p>
      </div>
    </main>
    </div>
  );
}
