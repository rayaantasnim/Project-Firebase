/**
 * PrimeFactor.app — Range Choosing Hub Controller
 * Coordinates the 10 Dynamic Range Selector Cards with 3D Parallax Tilt Tracking via GSAP.
 */

import { initGlobalHeader, renderFooter } from './header.js';
import { setActiveExamParams, getSettings } from './storage.js';
import { playSound } from './audio.js';
import { getUserElo, isRangeBannedForElo, getTierByElo } from './elo-engine.js';
import { waitForAuthReady, isUserLoggedIn, onAuthChange, signInWithGoogle } from './firebase.js';

document.addEventListener('DOMContentLoaded', async () => {
  initGlobalHeader();
  renderFooter();
  await waitForAuthReady();
  renderRangesGuestBanner();
  initTiltCards();
  onAuthChange(() => renderRangesGuestBanner());
});

function renderRangesGuestBanner() {
  const container = document.querySelector('.content-container') || document.querySelector('main');
  let banner = document.getElementById('ranges-guest-banner');
  if (!isUserLoggedIn()) {
    if (!banner && container) {
      banner = document.createElement('div');
      banner.id = 'ranges-guest-banner';
      banner.className = 'guest-warning-banner';
      banner.innerHTML = `
        <div class="guest-warning-content">
          <span style="font-size: 1.5rem;">⚠️</span>
          <div>
            <strong style="color: #FFFFFF; font-size: 1rem;">Guest Contender Mode</strong>
            <div style="font-size: 0.85rem; color: #CBD5E1;">Rated division runs will not update your official ELO rating or save matches unless signed in with Google.</div>
          </div>
        </div>
        <button id="btn-ranges-signin" class="guest-warning-btn">Sign In with Google</button>
      `;
      const head = container.querySelector('.section-head') || container.firstChild;
      if (head && head.parentNode) {
        head.parentNode.insertBefore(banner, head.nextSibling);
      } else {
        container.prepend(banner);
      }
      const btn = banner.querySelector('#btn-ranges-signin');
      if (btn) {
        btn.addEventListener('click', async () => {
          playSound('click');
          try {
            await signInWithGoogle();
          } catch(e) {}
        });
      }
    }
  } else if (banner) {
    banner.remove();
  }
}

function initTiltCards() {
  const cards = document.querySelectorAll('.range-tilt-card');
  const userElo = getUserElo();
  const userTier = getTierByElo(userElo);

  cards.forEach(card => {
    const maxVal = Number(card.getAttribute('data-max'));
    if (maxVal && isRangeBannedForElo(userElo, maxVal)) {
      card.setAttribute('data-forced-unrated', 'true');
      const badge = document.createElement('div');
      badge.className = 'range-firewall-badge';
      badge.innerHTML = `🛡️ Practice Mode · ELO Ceiling (${userTier.title})`;
      badge.style.cssText = 'background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #F59E0B; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 4px; margin-top: 0.65rem; display: inline-block;';
      card.appendChild(badge);
    }

    // Parallax 3D tilt tracking with GSAP
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      if (window.gsap) {
        window.gsap.to(card, {
          transformPerspective: 900,
          rotateX,
          rotateY,
          scale3d: [1.02, 1.02, 1.02],
          duration: 0.25,
          ease: 'power1.out'
        });
      }
    });

    card.addEventListener('mouseleave', () => {
      if (window.gsap) {
        window.gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          scale3d: [1, 1, 1],
          duration: 0.45,
          ease: 'power2.out'
        });
      }
    });

    // Click handler
    card.addEventListener('click', (e) => {
      e.preventDefault();
      playSound('click');

      const isCustom = card.getAttribute('data-is-custom') === 'true' || 
                       card.getAttribute('href')?.includes('custom.html') || 
                       card.id === 'tier-9-custom-card';
      if (isCustom) {
        window.location.href = './custom.html';
        return;
      }

      const min = Number(card.getAttribute('data-min'));
      const max = Number(card.getAttribute('data-max'));
      const time = Number(card.getAttribute('data-time')) || 180;
      const label = card.getAttribute('data-label') || `${min} - ${max}`;

      const isForcedUnrated = card.getAttribute('data-forced-unrated') === 'true' || isRangeBannedForElo(userElo, max);
      const participationMode = isForcedUnrated ? 'unrated' : 'rated';

      setActiveExamParams({
        min,
        max,
        title: label,
        timeLimit: time,
        rules: {
          ...getSettings(),
          participationMode,
          isForcedUnrated
        }
      });

      const targetUrl = `./contract.html?min=${min}&max=${max}&title=${encodeURIComponent(label)}&time=${time}&mode=${participationMode}${isForcedUnrated ? '&forcedUnrated=true' : ''}`;

      if (window.gsap) {
        window.gsap.to(card, {
          scale: 0.96,
          duration: 0.12,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            window.location.href = targetUrl;
          }
        });
      } else {
        window.location.href = targetUrl;
      }
    });
  });
}
