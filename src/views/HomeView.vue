<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="home">
    <section class="home__hero">
      <p class="home__eyebrow"><span class="home__dot" aria-hidden="true"></span>Small web experiments</p>
      <h1 class="home__title">A growing home for <em>beautiful</em> little things.</h1>
      <p class="home__lede">
        Tistacherous is a collection of focused web experiments. Each one gets a proper page,
        its own data, and a bit of care.
      </p>
    </section>

    <section class="home__section" aria-labelledby="projects-title">
      <div class="home__section-head">
        <h2 id="projects-title">Projects</h2>
        <span class="sub">1 live · more soon</span>
      </div>

      <div class="home__grid">
        <RouterLink class="card project" to="/historical-weather">
          <span class="project__icon" aria-hidden="true">🌤️</span>
          <h3 class="project__title">Historical Weather</h3>
          <p class="sub">
            Explore the record high, record low, and 50-year average for any day of the year —
            plus a forecast and every year on record since 1940.
          </p>
          <span class="project__cta">Open the dashboard <span aria-hidden="true">→</span></span>
        </RouterLink>

        <article class="card project project--placeholder">
          <span class="project__icon" aria-hidden="true">✨</span>
          <h3 class="project__title">The next idea</h3>
          <p class="sub">
            A reserved slot for whatever gets built next. The router is ready for it.
          </p>
          <span class="project__cta project__cta--muted">Coming soon</span>
        </article>
      </div>
    </section>
  </main>
</template>
