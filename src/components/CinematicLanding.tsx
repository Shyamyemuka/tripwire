"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Play,
  Menu,
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

interface DemoSentenceItem {
  text: string;
  verdict: "SUPPORTED" | "CONTRADICTED" | "NEUTRAL" | "UNVERIFIABLE";
}

const DEMO_SENTENCES: DemoSentenceItem[] = [
  {
    text: "Revenue increased 10% in Q3.",
    verdict: "SUPPORTED",
  },
  {
    text: "Operating costs fell 30% year-over-year.",
    verdict: "CONTRADICTED",
  },
  {
    text: "The quarter showed strong operational momentum.",
    verdict: "NEUTRAL",
  },
  {
    text: "Margin guidance is unclear from the source.",
    verdict: "UNVERIFIABLE",
  },
];

type SectionTab = "product" | "how-it-works" | "why-moss" | "livekit" | "docs";

export const CinematicLanding: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SectionTab>("product");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewActiveIndex, setPreviewActiveIndex] = useState<number>(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewActiveIndex((prev) => (prev + 1) % DEMO_SENTENCES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab: SectionTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="relative w-full min-h-screen bg-black text-white selection:bg-white/20 selection:text-white flex flex-col justify-between overflow-x-hidden">
      {/* Background Cinematic Video */}
      <video
        className="background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4"
          type="video/mp4"
        />
      </video>

      {/* Atmospheric Bottom Blur Layer */}
      <div className="bottom-blur" aria-hidden="true" />

      {/* Warm Environmental Vignette */}
      <div className="hero-vignette" aria-hidden="true" />

      {/* Navbar */}
      <header className="relative z-50 px-5 sm:px-8 md:px-12 py-5 md:py-6 flex items-center justify-between">
        {/* Brand Wordmark & Logo */}
        <div className="flex items-center gap-2.5">
          <Link href="/" onClick={() => setActiveTab("product")} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 bg-black flex items-center justify-center p-0.5 group-hover:border-white/40 transition-colors shrink-0">
              <Image
                src="/icon.png"
                alt="Tripwire Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="font-medium text-lg sm:text-xl tracking-[0.12em] text-white font-sans">
              TRIPWIRE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          </Link>
        </div>

        {/* Desktop In-Place Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-8">
          {[
            { id: "product" as SectionTab, label: "Product" },
            { id: "how-it-works" as SectionTab, label: "How It Works" },
            { id: "why-moss" as SectionTab, label: "Why Moss" },
            { id: "livekit" as SectionTab, label: "LiveKit Voice" },
            { id: "docs" as SectionTab, label: "Docs" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative text-[14px] font-medium transition-colors py-1 ${
                  isActive ? "text-white font-semibold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* View Demo -> /agent?demo=true */}
          <Link
            href="/agent?demo=true"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white bg-black/60 border border-white/15 hover:border-white/30 hover:bg-black/80 transition-all tactile-btn"
          >
            <Play className="w-3.5 h-3.5 text-white fill-white/20" />
            <span>View Demo</span>
          </Link>

          {/* Try Tripwire -> /agent */}
          <Link
            href="/agent"
            className="inline-flex items-center justify-center px-5 py-2 rounded-full text-xs font-semibold text-black bg-white hover:bg-neutral-200 transition-all tactile-btn shadow-sm"
          >
            <span>Try Tripwire</span>
          </Link>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
            className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-4 top-20 z-50 p-6 rounded-2xl bg-[#0A0A0A]/95 border border-white/10 backdrop-blur-xl shadow-2xl animate-blur-fade-up">
          <div className="flex flex-col gap-4">
            {[
              { id: "product" as SectionTab, label: "Product" },
              { id: "how-it-works" as SectionTab, label: "How It Works" },
              { id: "why-moss" as SectionTab, label: "Why Moss" },
              { id: "docs" as SectionTab, label: "Docs" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`text-left py-2 text-sm font-medium transition-colors flex items-center justify-between ${
                  activeTab === tab.id ? "text-white font-semibold" : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-xs text-neutral-500">→</span>
              </button>
            ))}

            <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
              <Link
                href="/agent?demo=true"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-full text-xs font-medium text-white bg-black/60 border border-white/15 flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-white" />
                <span>See It Catch a Claim</span>
              </Link>
              <Link
                href="/agent"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-full text-xs font-semibold text-black bg-white hover:bg-neutral-200 transition-colors text-center"
              >
                Try Tripwire
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area Over the Background Video */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-5 sm:px-8 md:px-12 py-8 lg:py-12 max-w-7xl mx-auto w-full">
        {/* Tab 1: Product (Default Hero) */}
        {activeTab === "product" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center animate-blur-fade-up">
            {/* Left: Hero Copy */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 max-w-[700px]">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 text-xs tracking-[0.12em] uppercase font-medium text-neutral-300">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-subtle-pulse" />
                <span>REAL-TIME AI VERIFICATION</span>
              </div>

              {/* Headline */}
              <h1 className="text-[44px] sm:text-[62px] md:text-[76px] lg:text-[84px] font-[500] leading-[0.98] tracking-[-0.05em] text-white">
                Verify Every Claim.<br />
                While AI Is Still Talking.
              </h1>

              {/* Subcopy */}
              <p className="text-[15px] sm:text-[17px] md:text-[18px] leading-[1.55] font-normal text-neutral-300 max-w-[610px]">
                Tripwire checks streamed LLM answers sentence by sentence against your source — catching contradictions before they become conclusions.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/agent"
                  className="px-7 sm:px-8 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200 tactile-btn shadow-lg flex items-center gap-2.5"
                >
                  <span>Try Tripwire</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </Link>

                <Link
                  href="/agent?demo=true"
                  className="px-6 sm:px-7 py-3.5 rounded-full text-sm font-medium text-white bg-black/60 border border-white/20 hover:border-white/40 hover:bg-black/80 tactile-btn flex items-center gap-2.5"
                >
                  <Play className="w-4 h-4 text-white fill-white/20" />
                  <span>See It Catch a Claim</span>
                </Link>
              </div>
            </div>

            {/* Right: Redesigned Minimalist Live Verification Preview */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[420px] rounded-2xl bg-black/80 p-5 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium tracking-[0.1em] text-white uppercase font-sans">
                      LIVE VERIFICATION
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">/ demo</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-neutral-300">
                    <Zap className="w-2.5 h-2.5 text-neutral-300" />
                    <span>MOSS</span>
                  </div>
                </div>

                {/* Subheader */}
                <div className="text-[10px] text-neutral-400 tracking-wide uppercase font-medium pt-2 pb-1.5 flex items-center justify-between">
                  <span>Sentence stream</span>
                  <span className="text-neutral-400 text-[9px] lowercase font-mono">sub-10ms retrieval</span>
                </div>

                {/* Sentence Rows without colored side borders */}
                <div className="space-y-2 pt-1">
                  {DEMO_SENTENCES.map((item, idx) => {
                    const isHighlighted = idx === previewActiveIndex;

                    let badge = null;
                    if (item.verdict === "SUPPORTED") {
                      badge = (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1 shrink-0 font-medium">
                          <CheckCircle2 className="w-2.5 h-2.5" /> SUPPORTED
                        </span>
                      );
                    } else if (item.verdict === "CONTRADICTED") {
                      badge = (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-semibold flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" /> CONTRADICTED
                        </span>
                      );
                    } else if (item.verdict === "UNVERIFIABLE") {
                      badge = (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex items-center gap-1 shrink-0 font-medium">
                          <HelpCircle className="w-2.5 h-2.5" /> UNVERIFIABLE
                        </span>
                      );
                    } else {
                      badge = (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-neutral-400 shrink-0">
                          NEUTRAL
                        </span>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => setPreviewActiveIndex(idx)}
                        className={`p-2.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isHighlighted
                            ? "bg-white/[0.08] shadow-inner"
                            : "bg-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex-1 leading-snug">
                          <span
                            className={`font-normal ${
                              item.verdict === "CONTRADICTED"
                                ? "text-white font-medium"
                                : item.verdict === "NEUTRAL"
                                ? "text-neutral-400"
                                : "text-neutral-200"
                            }`}
                          >
                            &ldquo;{item.text}&rdquo;
                          </span>
                        </div>
                        {badge}
                      </div>
                    );
                  })}
                </div>

                {/* Footer callout */}
                <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-neutral-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-neutral-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Contradiction flagged in stream</span>
                  </span>
                  <Link
                    href="/agent?demo=true"
                    className="text-white hover:underline font-medium text-[10px]"
                  >
                    Open in Agent →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: How It Works (In Place Over the Background Video) */}
        {activeTab === "how-it-works" && (
          <div className="max-w-4xl space-y-6 animate-blur-fade-up">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.12em] uppercase font-medium text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>FIVE-STAGE ARCHITECTURE</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
              How Tripwire checks claims while AI is still talking.
            </h2>

            <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
              Tripwire evaluates claims during generation rather than post-hoc, extracting punctuation boundaries from streaming tokens and executing fresh sub-10ms queries against your indexed document.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {[
                {
                  num: "01",
                  title: "Document Ingestion & Moss Indexing",
                  desc: "Source PDF or text is decomposed into semantic passages (200–400 tokens) with 15% overlap and indexed into Moss local vector cache.",
                },
                {
                  num: "02",
                  title: "Streaming Token Slicing",
                  desc: "Tokens from the LLM are monitored by a sliding boundary detector. Complete sentences dispatch immediately.",
                },
                {
                  num: "03",
                  title: "Sub-10ms Passage Retrieval",
                  desc: "Every completed sentence issues its own fresh independent query against the indexed source using Moss.",
                },
                {
                  num: "04",
                  title: "Separate NLI Classification",
                  desc: "Passage candidate and sentence are checked for polarity, number, and entity mismatches. Errors default to amber.",
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1.5 backdrop-blur-md"
                >
                  <div className="text-[11px] font-mono text-neutral-500">{step.num}</div>
                  <div className="text-sm font-medium text-white">{step.title}</div>
                  <div className="text-xs text-neutral-400 leading-relaxed">{step.desc}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-3">
              <Link
                href="/agent"
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors tactile-btn"
              >
                Launch Agent Workspace →
              </Link>
              <button
                onClick={() => setActiveTab("product")}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                ← Back to Overview
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Why Moss (In Place Over the Background Video) */}
        {activeTab === "why-moss" && (
          <div className="max-w-4xl space-y-6 animate-blur-fade-up">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.12em] uppercase font-medium text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>SUB-10MS RETRIEVAL BENCHMARK</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
              Why traditional vector DBs cannot verify live streaming speech.
            </h2>

            <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
              Checking 8–15 sentences per streaming paragraph requires sub-10ms latency. Traditional cloud vector roundtrips take 120–250ms, accumulating several seconds of lag and breaking the stream.
            </p>

            <div className="space-y-3 pt-2 max-w-2xl">
              <div className="p-4 rounded-xl bg-black/70 border border-white/15 flex items-center justify-between backdrop-blur-md">
                <div>
                  <div className="text-xs font-semibold text-white">Moss Local Vector Search</div>
                  <div className="text-[11px] text-neutral-400">In-process compiled index lookup</div>
                </div>
                <div className="text-sm font-mono font-semibold text-white">~1.8ms – 8.5ms</div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-white/10 flex items-center justify-between backdrop-blur-md">
                <div>
                  <div className="text-xs font-medium text-neutral-300">Baseline Brute-Force Scan</div>
                  <div className="text-[11px] text-neutral-500">Unindexed cosine scan (CPU intensive)</div>
                </div>
                <div className="text-sm font-mono text-neutral-400">~45ms – 180ms</div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-white/10 flex items-center justify-between backdrop-blur-md">
                <div>
                  <div className="text-xs font-medium text-neutral-400">Cloud Vector Database API</div>
                  <div className="text-[11px] text-neutral-500">Network HTTP roundtrip per sentence</div>
                </div>
                <div className="text-sm font-mono text-neutral-500">~120ms – 300ms</div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-3">
              <Link
                href="/agent"
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors tactile-btn"
              >
                Test A/B Latency in Agent →
              </Link>
              <button
                onClick={() => setActiveTab("product")}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                ← Back to Overview
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: LiveKit Voice Integration */}
        {activeTab === "livekit" && (
          <div className="max-w-4xl space-y-6 animate-blur-fade-up">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.12em] uppercase font-medium text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>LIVEKIT VOICE INTEGRATION · FR-13</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
              Speak questions naturally. Verified live sentence-by-sentence.
            </h2>

            <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
              Tripwire integrates LiveKit room authentication and dual-mode real-time speech recognition. Ask complex questions out loud, and watch Tripwire stream and fact-check every sentence against the source material in real time.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 max-w-3xl">
              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1.5 backdrop-blur-md">
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>One-Click Voice Mic</span>
                </div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  Continuous low-latency audio capture using MediaRecorder &amp; Web Speech API with zero audio cutoffs across all browsers.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1.5 backdrop-blur-md">
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>LiveKit Room Token Protocol</span>
                </div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  Secure /api/livekit-token endpoint issues authenticated grants for WebRTC sessions and agent speech transcription.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-3">
              <Link
                href="/agent"
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors tactile-btn"
              >
                Try Voice in Workspace →
              </Link>
              <button
                onClick={() => setActiveTab("product")}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                ← Back to Overview
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Docs (In Place Over the Background Video) */}
        {activeTab === "docs" && (
          <div className="max-w-4xl space-y-6 animate-blur-fade-up">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.12em] uppercase font-medium text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>SPECIFICATION &amp; INVARIANTS</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
              Tripwire Core Invariants.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 max-w-3xl">
              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1 backdrop-blur-md">
                <div className="text-xs font-semibold text-white">1. Similarity Is Not Truth</div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  Moss score retrieves candidate passages; separate NLI evaluation determines SUPPORTED, CONTRADICTED, or UNVERIFIABLE.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1 backdrop-blur-md">
                <div className="text-xs font-semibold text-white">2. Fresh Queries Per Sentence</div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  Every sentence queries Moss independently rather than reusing generation-time context.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1 backdrop-blur-md">
                <div className="text-xs font-semibold text-white">3. Failures Default to Amber</div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  On classifier timeout or parse error, status resolves to UNVERIFIABLE, never GREEN.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-1 backdrop-blur-md">
                <div className="text-xs font-semibold text-white">4. Genuine Latency Measurements</div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  Every displayed millisecond is measured from performance.now() on the actual code path.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-3">
              <Link
                href="/agent"
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors tactile-btn"
              >
                Launch Agent →
              </Link>
              <button
                onClick={() => setActiveTab("product")}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                ← Back to Overview
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Hero Lower System Strip */}
      <footer className="relative z-10 px-5 sm:px-8 md:px-12 py-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 font-medium text-[11px] sm:text-xs text-neutral-400">
          <span>Sentence-level verification</span>
          <span className="text-neutral-600">·</span>
          <span>Source-backed evidence</span>
          <span className="text-neutral-600">·</span>
          <span>Live retrieval measurement</span>
        </div>

        <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          <span>MOSS Sub-10ms Active Engine</span>
        </div>
      </footer>
    </div>
  );
};
