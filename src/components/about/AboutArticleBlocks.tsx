import type { ReactNode } from 'react'
import type {
  AboutArticle,
  AboutOutlineNode,
  AboutPageContent,
} from '#/lib/content-types'
import { SECTIONS } from '#/lib/sections'

const HREF_BY_NAME: Record<string, string> = Object.fromEntries(
  SECTIONS.map((section) => [section.id, section.href]),
)

const INLINE_PATTERN =
  '(The Universal Creator|Universal Creator)|((?:See|see|Go to)\\s+(?:the\\s+)?(Legal|Infrastructure|Research|Beliefs|Community|Medical)(?:\\s+section)?)'

const OUTLINE_TIERS = [
  {
    marker: 'text-[#d4a24a] font-medium',
    text: 'text-[15px] leading-[1.72] text-[#ece2c4]',
  },
  {
    marker: 'text-[#d4a24a]/85 font-medium',
    text: 'text-[14px] leading-[1.66] text-[#ded3b3]',
  },
  {
    marker: 'text-[#c2b48c]',
    text: 'text-[13.5px] leading-[1.62] text-[#cdc1a1]',
  },
  {
    marker: 'text-[#b3a884]',
    text: 'text-[13px] leading-[1.6] text-[#bfb392]',
  },
  {
    marker: 'text-[#9f956f]',
    text: 'text-[12.5px] leading-[1.58] text-[#b1a684]',
  },
] as const

function renderInline(text: string, keyBase: string) {
  const output: Array<ReactNode> = []
  const pattern = new RegExp(INLINE_PATTERN, 'g')
  let last = 0
  let index = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) output.push(text.slice(last, match.index))
    if (match[1]) {
      output.push(
        <span
          key={`${keyBase}-c${index}`}
          className="font-medium uppercase tracking-[0.08em] text-[#e9c987]"
        >
          {match[1]}
        </span>,
      )
    } else {
      const phrase = match[2]
      const name = match[3]
      const nameIndex = phrase.indexOf(name)
      const prefix = phrase.slice(0, nameIndex)
      const suffix = phrase.slice(nameIndex + name.length)
      const href = HREF_BY_NAME[name.toLowerCase()]
      output.push(prefix)
      output.push(
        href ? (
          <a
            key={`${keyBase}-r${index}`}
            href={href}
            className="font-medium text-[#e9c987] underline decoration-[rgba(212,162,74,0.4)] decoration-from-font underline-offset-[3px] transition-colors hover:decoration-[#d4a24a]"
          >
            {name}
          </a>
        ) : (
          <span
            key={`${keyBase}-r${index}`}
            className="font-medium text-[#cdb98a]"
          >
            {name}
          </span>
        ),
      )
      output.push(suffix)
    }
    last = match.index + match[0].length
    index++
  }
  if (last < text.length) output.push(text.slice(last))
  return output
}

function OutlineList({
  nodes,
  depth,
  idBase,
}: {
  nodes: ReadonlyArray<AboutOutlineNode>
  depth: number
  idBase: string
}) {
  const tier = OUTLINE_TIERS[Math.min(depth, OUTLINE_TIERS.length - 1)]
  return (
    <ul
      className={
        depth === 0
          ? 'mt-6 flex list-none flex-col gap-4 p-0'
          : 'mt-3 flex list-none flex-col gap-3 border-l border-[rgba(212,162,74,0.16)] py-0.5 pl-[clamp(12px,1.8vw,22px)]'
      }
    >
      {nodes.map((node, index) => {
        const key = `${idBase}-${index}`
        return (
          <li key={key} className="flex items-baseline gap-2.5">
            <span
              className={`flex-none whitespace-nowrap text-right tabular-nums ${tier.marker} min-w-[2em] text-[0.86em] tracking-wide`}
            >
              {node.marker}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`m-0 ${tier.text}`}>
                {renderInline(node.text, key)}
              </p>
              {node.children.length > 0 ? (
                <OutlineList
                  nodes={node.children}
                  depth={depth + 1}
                  idBase={key}
                />
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function AboutArticleBlock({
  article,
  index,
}: {
  article: AboutArticle
  index: number
}) {
  return (
    <section
      id={article.id}
      data-article
      className="ab-rise scroll-mt-[160px]"
      style={{ animationDelay: `${120 + index * 70}ms` }}
    >
      <div className="flex items-baseline gap-4 sm:gap-6">
        <div>
          <h2
            className="m-0 font-thin tracking-[-0.01em] text-[#f3ead0]"
            style={{ fontSize: 'clamp(22px,3vw,34px)' }}
          >
            {article.eyebrow}
          </h2>
        </div>
      </div>

      <div
        className="mt-5 h-px w-full"
        style={{
          background:
            'linear-gradient(90deg, rgba(212,162,74,0.55), rgba(212,162,74,0.05) 75%, transparent)',
        }}
      />

      <p
        className="mb-0 mt-6 font-light text-[#ece2c4]"
        style={{ fontSize: 'clamp(15.5px,1.8vw,18px)', lineHeight: 1.7 }}
      >
        {renderInline(article.lead, article.id)}
      </p>

      {article.body.length > 0 ? (
        <OutlineList nodes={article.body} depth={0} idBase={article.id} />
      ) : null}
    </section>
  )
}

export function AboutContactBlock({
  contact,
}: {
  contact: AboutPageContent['contact']
}) {
  return (
    <section id="contact" data-article className="ab-rise scroll-mt-[160px]">
      <div className="flex items-baseline gap-4 sm:gap-6">
        <div>
          <h2
            className="m-0 font-thin tracking-[-0.01em] text-[#f3ead0]"
            style={{ fontSize: 'clamp(22px,3vw,34px)' }}
          >
            {contact.eyebrow}
          </h2>
        </div>
      </div>

      <div
        className="mt-5 h-px w-full"
        style={{
          background:
            'linear-gradient(90deg, rgba(212,162,74,0.55), rgba(212,162,74,0.05) 75%, transparent)',
        }}
      />

      <p
        className="mb-0 mt-6 font-light text-[#cdc2a4]"
        style={{ fontSize: '15px', lineHeight: 1.7 }}
      >
        {contact.intro}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {contact.channels.map((channel) => {
          const content = (
            <>
              <div className="text-[10px] uppercase tracking-[0.34em] text-[#b8ad8d]">
                {channel.label}
              </div>
              <div className="mt-2 text-[18px] font-light tracking-[0.02em] text-[#f3ead0]">
                {channel.handle}
              </div>
            </>
          )
          const className =
            'group relative block overflow-hidden border border-[rgba(212,162,74,0.28)] bg-[rgba(212,162,74,0.04)] p-5 no-underline transition-colors duration-300 hover:border-[rgba(212,162,74,0.6)] hover:bg-[rgba(212,162,74,0.08)] [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]'
          return channel.href ? (
            <a
              key={channel.id}
              href={channel.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
              <span className="absolute right-4 top-4 text-[#d4a24a] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                ↗
              </span>
            </a>
          ) : (
            <div key={channel.id} className={className}>
              {content}
            </div>
          )
        })}
      </div>
    </section>
  )
}
