import { notFound } from "next/navigation";
import Link from "next/link";
import path from "path";
import fs from "fs";
import PageShell from "@/components/PageShell";
import MarkdownContent from "@/components/MarkdownContent";
import { LEARN_MODULES, getModuleBySlug } from "@/lib/learn/modules";
import styles from "./module.module.css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEARN_MODULES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const mod = getModuleBySlug(slug);
  if (!mod) return { title: "Not Found" };
  return {
    title: `${mod.title} | Learn | Carbon Contractors`,
    description: mod.description,
  };
}

export default async function LearnModulePage({ params }: PageProps) {
  const { slug } = await params;
  const mod = getModuleBySlug(slug);
  if (!mod) notFound();

  const filePath = path.join(process.cwd(), "src", "learn", mod.filename);
  const content = fs.readFileSync(filePath, "utf-8");

  const prevMod = LEARN_MODULES[mod.moduleNumber - 2] ?? null;
  const nextMod = LEARN_MODULES[mod.moduleNumber] ?? null;

  return (
    <PageShell>
      <div className={styles.container}>
        <div className={styles.meta}>
          <Link href="/learn" className={styles.backLink}>
            &larr; ALL MODULES
          </Link>
          <span className={styles.progress}>
            MODULE {mod.moduleNumber} OF {LEARN_MODULES.length}
          </span>
          <span className={styles.readTime}>{mod.readTime} READ</span>
        </div>

        <article className={styles.article}>
          <MarkdownContent content={content} />
        </article>

        <nav className={styles.nav}>
          {prevMod ? (
            <Link href={`/learn/${prevMod.slug}`} className={styles.navLink}>
              <span className={styles.navLabel}>&larr; PREVIOUS</span>
              <span className={styles.navTitle}>{prevMod.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextMod ? (
            <Link
              href={`/learn/${nextMod.slug}`}
              className={`${styles.navLink} ${styles.navLinkNext}`}
            >
              <span className={styles.navLabel}>NEXT &rarr;</span>
              <span className={styles.navTitle}>{nextMod.title}</span>
            </Link>
          ) : (
            <Link
              href="/connect"
              className={`${styles.navLink} ${styles.navLinkNext}`}
            >
              <span className={styles.navLabel}>GET STARTED &rarr;</span>
              <span className={styles.navTitle}>Register as a Worker</span>
            </Link>
          )}
        </nav>
      </div>
    </PageShell>
  );
}
