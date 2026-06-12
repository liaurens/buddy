import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Settings, Terminal, MessageSquare, AlertTriangle } from 'lucide-react'

interface SectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

const Section: React.FC<SectionProps> = ({ title, icon, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-3 pb-3 text-xs text-slate-600 space-y-2">{children}</div>}
    </div>
  )
}

function CommandRow({ cmd, desc, example }: { cmd: string; desc: string; example?: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div className="flex items-center gap-2">
        <code className="font-mono text-indigo-600 font-medium text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded">{cmd}</code>
        <span className="text-slate-500">{desc}</span>
      </div>
      {example && (
        <span className="text-[11px] text-slate-400 ml-1">e.g. <code className="font-mono">{example}</code></span>
      )}
    </div>
  )
}

const AssistantGuide: React.FC = () => {
  return (
    <div className="space-y-2 px-1">
      <div className="text-center mb-3">
        <p className="text-sm font-semibold text-slate-700">Buddy Assistant Guide</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Everything you need to get started</p>
      </div>

      {/* Setup Section */}
      <Section title="Setup — Configure AI" icon={<Settings size={14} className="text-amber-500" />} defaultOpen>
        <p>To enable AI-powered responses, you need an API key from one of these providers:</p>
        <div className="space-y-1 mt-1.5">
          <div className="bg-slate-50 rounded-md p-2">
            <p className="font-medium text-slate-700">1. Get an API key</p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
              <li><strong>OpenAI:</strong> platform.openai.com/api-keys</li>
              <li><strong>Anthropic:</strong> console.anthropic.com/settings/keys</li>
              <li><strong>Google Gemini:</strong> aistudio.google.com/apikey</li>
            </ul>
          </div>
          <div className="bg-slate-50 rounded-md p-2">
            <p className="font-medium text-slate-700">2. Add it in the app</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Go to <strong>Account</strong> (profile icon) &rarr; find the <strong>AI Provider</strong> section &rarr; select your provider, paste your API key, and hit Save.
            </p>
          </div>
          <div className="bg-slate-50 rounded-md p-2">
            <p className="font-medium text-slate-700">3. Start chatting</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Once configured, you can ask questions and get AI-powered answers right here in the chat.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-amber-600 mt-2">
          Without an API key, the assistant can still handle slash commands and pattern-based actions — just not open questions.
        </p>
      </Section>

      {/* Commands Section */}
      <Section title="Commands" icon={<Terminal size={14} className="text-indigo-500" />}>
        <p className="mb-2">Type <code className="font-mono text-indigo-600">/</code> to see suggestions. Available commands:</p>

        <p className="font-medium text-slate-700 mt-2 mb-1">Planning</p>
        <div className="space-y-0.5">
          <CommandRow cmd="/task" desc="Create a task" example="/task Fix bike by friday" />
          <CommandRow cmd="/done" desc="Complete a task" example="/done fix bike" />
          <CommandRow cmd="/today" desc="Show today's tasks" />
          <CommandRow cmd="/task.list" desc="List all open tasks" />
          <CommandRow cmd="/remind" desc="Set a reminder" example="/remind 14:00 call dentist" />
        </div>

        <p className="font-medium text-slate-700 mt-3 mb-1">Notes &amp; Content</p>
        <div className="space-y-0.5">
          <CommandRow cmd="/note" desc="Save a note" example="/note Meeting notes from today" />
          <CommandRow cmd="/shop" desc="Add to shopping list" example="/shop Milk and cheese" />
          <CommandRow cmd="/find" desc="Search notes" example="/find machine learning" />
        </div>

        <p className="font-medium text-slate-700 mt-3 mb-1">Health &amp; Calendar</p>
        <div className="space-y-0.5">
          <CommandRow cmd="/checkin" desc="Log health metrics" example="/checkin mood 4 sleep 7 energy 3" />
          <CommandRow cmd="/health" desc="Query health data" example="/health how was my sleep?" />
          <CommandRow cmd="/agenda" desc="Show today's events" />
        </div>

        <p className="font-medium text-slate-700 mt-3 mb-1">System</p>
        <div className="space-y-0.5">
          <CommandRow cmd="/help" desc="Show all commands in chat" />
          <CommandRow cmd="/feedback" desc="Send feedback" example="/feedback Love this feature!" />
        </div>
      </Section>

      {/* Natural Language Section */}
      <Section title="Natural Language" icon={<MessageSquare size={14} className="text-emerald-500" />}>
        <p className="mb-2">You don't always need slash commands. Buddy understands natural language too:</p>

        <div className="space-y-1.5">
          <div className="bg-emerald-50 rounded-md p-2">
            <p className="font-medium text-emerald-700">Shopping</p>
            <p className="text-[11px] text-emerald-600">"Koop melk" &rarr; saved to shopping list</p>
            <p className="text-[11px] text-emerald-600">"Buy bread and eggs" &rarr; shopping note</p>
          </div>
          <div className="bg-blue-50 rounded-md p-2">
            <p className="font-medium text-blue-700">Tasks</p>
            <p className="text-[11px] text-blue-600">"Remind me to call the dentist" &rarr; creates reminder</p>
            <p className="text-[11px] text-blue-600">"Wat moet ik vandaag doen?" &rarr; shows today's tasks</p>
          </div>
          <div className="bg-purple-50 rounded-md p-2">
            <p className="font-medium text-purple-700">Questions (requires AI)</p>
            <p className="text-[11px] text-purple-600">"How can I study more effectively?" &rarr; AI response</p>
            <p className="text-[11px] text-purple-600">"What's the Pomodoro technique?" &rarr; AI response</p>
          </div>
        </div>
      </Section>

      {/* Response Types Section */}
      <Section title="Response Types" icon={<AlertTriangle size={14} className="text-cyan-500" />}>
        <div className="space-y-1.5">
          <div className="bg-slate-50 rounded-md p-2">
            <p className="font-medium text-slate-700">Action Cards</p>
            <p className="text-[11px] text-slate-500">
              When the assistant creates a task, saves a note, or logs health data, you'll see a card with a checkmark
              and a link to navigate to the relevant section.
            </p>
          </div>
          <div className="bg-slate-50 rounded-md p-2">
            <p className="font-medium text-slate-700">Chat Responses</p>
            <p className="text-[11px] text-slate-500">
              For general questions, the AI responds with a text message — just like chatting with a friend.
              Requires an AI provider to be configured.
            </p>
          </div>
          <div className="bg-slate-50 rounded-md p-2">
            <p className="font-medium text-slate-700">Error Messages</p>
            <p className="text-[11px] text-slate-500">
              If something goes wrong (e.g. invalid API key, network issue), you'll see a red error card.
              Check your API key in Settings if you see authentication errors.
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}

export default AssistantGuide
