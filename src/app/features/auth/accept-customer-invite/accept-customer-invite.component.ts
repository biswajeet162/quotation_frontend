import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Public placeholder until customer invite onboarding is built. No auth. */
@Component({
  selector: 'app-accept-customer-invite',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="card">
        <p class="eyebrow">Asian Procurement Service</p>
        <h1>Customer invitation</h1>
        <p>
          This invite link is public and does not require login. The full customer onboarding
          flow is coming next — for now you can join us from the link below.
        </p>
        <a routerLink="/join-us" class="btn">Join us</a>
        <p class="footer"><a routerLink="/">Back to home</a></p>
      </div>
    </div>
  `,
  styles: `
    .page {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      background: linear-gradient(145deg, #0f172a 0%, #134e4a 50%, #0f766e 100%);
    }
    .card {
      width: min(440px, 100%);
      background: #fff;
      border-radius: 16px;
      padding: 1.75rem;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
    }
    .eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f766e;
    }
    h1 {
      margin: 0 0 0.75rem;
      font-size: 1.45rem;
      color: #0f172a;
    }
    p {
      margin: 0 0 1.25rem;
      color: #64748b;
      line-height: 1.5;
      font-size: 0.95rem;
    }
    .btn {
      display: inline-flex;
      padding: 0.75rem 1.1rem;
      border-radius: 10px;
      background: #0f766e;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    .footer {
      margin: 1.25rem 0 0;
      font-size: 0.85rem;
    }
    .footer a {
      color: #0f766e;
      font-weight: 600;
      text-decoration: none;
    }
  `,
})
export class AcceptCustomerInviteComponent {}
