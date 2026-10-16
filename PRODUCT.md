# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: omp (oh-my-pi) users who want to find a plugin and know whether it works on omp before they install it. Secondary: plugin authors who want their package listed with a correct omp status.

## Product Purpose

A package catalog for omp. It lists npm packages built for omp and pi packages that may or may not work on omp, and it collects community reports on whether each one works. Success: a user can find a package, see its omp status, and copy the install command in seconds.

## Positioning

Compatibility first. Every package carries an omp status: omp-native, works, broken, or untested. pi.dev cannot show this, because it does not track omp.

## Operating Context

Users arrive from a terminal session. They install with `omp plugin install <name>`. Packages come from npm search on the keywords `omp-package`, `omp-plugin`, `omp-extension`, `oh-my-pi`, and `pi-package`.

## Capabilities and Constraints

- Server-rendered HTML from one Cloudflare Worker; D1 storage; cron sync from npm.
- Reports: works or broken, one per IP per package, optional note.
- Only npm-published packages are listed.
- No accounts, no JavaScript framework.

## Brand Commitments

Name: "omp packages". No logo or palette to preserve.

## Evidence on Hand

Real package data from npm (names, descriptions, monthly downloads, publish dates) and user reports in D1. No testimonials, endorsements, or official affiliation with oh-my-pi; do not claim any.

## Product Principles

1. Status before popularity: the omp status is the first thing a user reads.
2. The install command is always one click from copy.
3. Untested is honest, not alarming; broken is clear.
4. Authors get one obvious path to get listed.
