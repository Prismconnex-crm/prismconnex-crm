"use client";

import { useState, useRef, useEffect, forwardRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Bot, CheckCircle2, AlertTriangle, Clock, X, FileText, Zap, Pause, Edit3, Loader2, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string | React.ReactNode;
    timestamp: Date;
    isTyping?: boolean;
    actions?: React.ReactNode;
};

export function CopilotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"ask" | "draft" | "do">("ask");

    return (
        <>
            {/* Floating Action Button */}
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300",
                    isOpen 
                        ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" 
                        : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_8px_30px_rgb(79,70,229,0.4)]"
                )}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <X className="size-6" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="bot"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Bot className="size-6" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Widget Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: "bottom right" }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#22304A] dark:bg-[#0B1220] sm:w-[90vw] md:w-[850px] lg:w-[1000px] h-[80vh] max-h-[800px]"
                    >
                        {/* Header */}
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#22304A] dark:bg-[#111B2E]">
                            <div className="flex items-center gap-3">
                                <div className="flex size-8 items-center justify-center rounded-full bg-indigo-600 text-white">
                                    <Bot className="size-4" />
                                </div>
                                <div>
                                    <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">AI Copilot</h2>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Ask, draft, and take actions</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 dark:border-[#22304A] dark:bg-[#0B1220]">
                                    <button 
                                        onClick={() => setActiveTab("ask")}
                                        className={cn("rounded-md px-3 py-1 text-[11px] font-bold transition-colors", activeTab === "ask" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}
                                    >
                                        Ask
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab("draft")}
                                        className={cn("rounded-md px-3 py-1 text-[11px] font-bold transition-colors", activeTab === "draft" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}
                                    >
                                        Draft
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab("do")}
                                        className={cn("rounded-md px-3 py-1 text-[11px] font-bold transition-colors", activeTab === "do" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}
                                    >
                                        Do
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-transparent">
                            {activeTab === "ask" && <AskView />}
                            {activeTab === "draft" && <DraftView />}
                            {activeTab === "do" && <DoView />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// -------------------------------------------------------------
// ASK VIEW (Chat & Actions Inspector)
// -------------------------------------------------------------
function AskView() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hello! I'm your Prism AI Copilot. I can help you find companies, people, and events, draft sequences, or manage your CRM. How can I assist you today?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue,
            timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setIsTyping(true);

        // Simulate AI thinking and response
        setTimeout(() => {
            generateSimulatedResponse(userMsg.content as string);
        }, 1500);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSendMessage();
    };

    const handleSuggestion = (text: string) => {
        setInputValue(text);
        setTimeout(() => {
            // Trigger send logic directly
            const userMsg: Message = {
                id: Date.now().toString(),
                role: "user",
                content: text,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMsg]);
            setInputValue("");
            setIsTyping(true);
            setTimeout(() => generateSimulatedResponse(text), 1500);
        }, 50);
    };

    // Simulated AI Engine
    const generateSimulatedResponse = (query: string) => {
        setIsTyping(false);
        const lowerQuery = query.toLowerCase();
        
        let responseContent: React.ReactNode = "";
        let responseActions: React.ReactNode = undefined;

        if (lowerQuery.includes("berlin") || lowerQuery.includes("event") || lowerQuery.includes("tech")) {
            responseContent = (
                <ul className="space-y-1.5 list-disc list-inside">
                    <li>Found 12 matching tech events in Berlin in the next 90 days.</li>
                    <li>Top companies attending: NovaAI Systems, CloudForge Ltd, SecureNet Dynamics.</li>
                    <li>Recommended Next Step: Build a target list or create an outreach sequence.</li>
                </ul>
            );
            responseActions = (
                <div className="flex flex-wrap gap-1.5 mt-3">
                    <button className="px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 transition-colors">
                        Create Target List
                    </button>
                    <button className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#111B2E] dark:hover:bg-[#16233A] text-[10px] font-bold text-slate-700 dark:text-white transition-colors shadow-sm">
                        Draft Sequence
                    </button>
                </div>
            );
        } else if (lowerQuery.includes("claude") || lowerQuery.includes("opus") || lowerQuery.includes("4.6") || lowerQuery.includes("how it works") || lowerQuery.includes("work")) {
            responseContent = (
                <div className="space-y-2">
                    <p><strong>Claude Opus 4.6</strong> is an advanced large language model developed by Anthropic. It works by:</p>
                    <ul className="space-y-1.5 list-decimal list-inside ml-1">
                        <li><strong>Processing Context:</strong> It reads and analyzes vast amounts of provided text or CRM data in real-time.</li>
                        <li><strong>Pattern Recognition:</strong> Using deep neural networks, it understands semantic meaning, user intent, and complex logical reasoning.</li>
                        <li><strong>Generation:</strong> It predicts the most highly relevant, professional response token-by-token based on its training on safety, helpfulness, and factual accuracy.</li>
                    </ul>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Within this CRM, it acts as an intelligent layer to query your database, draft emails, and automate workflows securely.</p>
                </div>
            );
        } else if (lowerQuery.includes("company") || lowerQuery.includes("companies") || lowerQuery.includes("bighaat") || lowerQuery.includes("fidensgen")) {
             responseContent = (
                <p>I found those companies in your CRM database! <strong>FidensGen</strong> is listed under 'Information Technology & Services' and <strong>BigHaat</strong> is prominently featured in 'Agriculture'. Would you like me to add them to a target account list or start a deal workflow?</p>
            );
        } else {
            responseContent = (
                <p>I can certainly help with that. Since I'm connected directly to your CRM, I can analyze accounts, draft personalized sequences, manage your automation tasks, or answer general knowledge questions. Could you provide a bit more detail on what you'd like to achieve?</p>
            );
        }

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: responseContent,
            actions: responseActions,
            timestamp: new Date()
        }]);
    };

    return (
        <div className="flex h-full flex-col md:flex-row">
            {/* Left: Chat Interface */}
            <div className="flex h-full w-full flex-col border-r border-slate-200 dark:border-[#22304A] md:w-3/5 lg:w-2/3">
                <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white p-3 dark:border-[#22304A] dark:bg-[#0B1220]">
                    <button onClick={() => handleSuggestion("Build target list for Berlin Tech")} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-[#16233A]">
                        Build Berlin Tech list
                    </button>
                    <button onClick={() => handleSuggestion("How Claude 4.6 works")} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-[#16233A]">
                        How Claude 4.6 works?
                    </button>
                    <button onClick={() => handleSuggestion("Draft a 4-step sequence")} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-[#16233A]">
                        Draft 4-step sequence
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/50 dark:bg-[#070B14]/30">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start items-start gap-3")}>
                            {msg.role === "assistant" && (
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                                    <Sparkles className="size-3.5 text-white" />
                                </div>
                            )}
                            
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-[12px] shadow-sm",
                                msg.role === "user" 
                                    ? "rounded-tr-sm bg-indigo-600 text-white" 
                                    : "rounded-tl-sm border border-slate-200 bg-white text-slate-800 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200"
                            )}>
                                <div className="leading-relaxed font-medium">
                                    {msg.content}
                                </div>
                                {msg.actions && (
                                    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-white/5">
                                        {msg.actions}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex items-start gap-3">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                                <Sparkles className="size-3.5 text-white" />
                            </div>
                            <div className="flex h-10 w-16 items-center justify-center rounded-2xl rounded-tl-sm border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                                <Loader2 className="size-4 animate-spin text-indigo-500" />
                            </div>
                        </div>
                    )}
                    
                    <div ref={endOfMessagesRef} />
                </div>

                <div className="border-t border-slate-200 bg-white p-3 dark:border-[#22304A] dark:bg-[#0B1220]">
                    <div className="relative flex items-center">
                        <input 
                            type="text" 
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Prism Copilot anything..." 
                            className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 pl-4 pr-12 text-[12px] font-medium text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-[#374151] dark:bg-[#111B2E] dark:text-white dark:placeholder:text-slate-500"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim()}
                            className="absolute right-2 flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
                        >
                            <Send className="size-3.5" />
                        </button>
                    </div>
                    <div className="mt-1.5 text-center text-[9px] text-slate-400">
                        AI Copilot can make mistakes. Consider verifying important CRM data.
                    </div>
                </div>
            </div>

            {/* Right: Actions & Audit (Hidden on small screens) */}
            <div className="hidden h-full flex-col gap-4 overflow-y-auto bg-slate-50 p-4 dark:bg-[#070B14] md:flex md:w-2/5 lg:w-1/3">
                {/* Active Proposed Action */}
                <div className="relative flex flex-col overflow-hidden rounded-xl border border-indigo-500/40 bg-white p-4 shadow-sm dark:bg-[#0B1220]">
                    <div className="absolute right-0 top-0 size-32 rounded-full bg-indigo-600/10 blur-[40px] pointer-events-none"></div>
                    
                    <div className="relative z-10 mb-4">
                        <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">Proposed Action</h3>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">Requires confirmation</p>
                    </div>

                    <div className="relative z-10 mb-4 flex-1 space-y-2">
                        <div className="flex gap-2 text-[10px]">
                            <span className="w-[45px] shrink-0 font-bold text-slate-400 dark:text-slate-500">Action:</span>
                            <span className="font-bold text-slate-800 dark:text-white">Create Target List</span>
                        </div>
                        <div className="flex gap-2 text-[10px]">
                            <span className="w-[45px] shrink-0 font-bold text-slate-400 dark:text-slate-500">Name:</span>
                            <span className="font-bold text-slate-800 dark:text-white">Berlin Tech — Next 90 Days</span>
                        </div>
                        <div className="flex gap-2 text-[10px]">
                            <span className="w-[45px] shrink-0 font-bold text-slate-400 dark:text-slate-500">Size:</span>
                            <span className="font-bold text-slate-800 dark:text-white">60 companies</span>
                        </div>
                    </div>

                    <div className="relative z-10 mb-4 space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-[#22304A] dark:bg-[#070B14]">
                        <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="size-3 text-emerald-500" /> Deduplicate by domain
                        </div>
                        <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="size-3 text-emerald-500" /> Filter confidence ≥ 80%
                        </div>
                    </div>

                    <div className="relative z-10 mt-auto flex gap-2">
                        <button className="flex h-8 flex-1 items-center justify-center rounded-md bg-indigo-600 text-[10.5px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all hover:bg-indigo-500">
                            Confirm Action
                        </button>
                    </div>
                </div>

                {/* Permissions */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#0B1220]">
                   <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-900 dark:text-white">Permissions</h3>
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-700 dark:text-[#E5E7EB]">Can create lists</span>
                            <span className="flex items-center gap-1 font-bold text-emerald-500">Allowed <CheckCircle2 className="size-3" /></span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] dark:border-[#22304A]">
                            <span className="font-bold text-slate-700 dark:text-[#E5E7EB]">Can send bulk email</span>
                            <span className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-transparent dark:bg-amber-500/10 dark:text-amber-500">Requires approval <AlertTriangle className="size-2.5" /></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// DRAFT VIEW
// -------------------------------------------------------------
function DraftView() {
    return (
        <div className="flex h-full flex-col p-4 md:flex-row gap-4 overflow-y-auto">
            {/* Drafts List */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#070B14] w-full md:w-1/3 shrink-0">
                <div className="border-b border-slate-200 bg-slate-50 p-3 dark:border-[#22304A] dark:bg-[#111B2E]">
                     <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-900 dark:text-white">Active Drafts</h3>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    <div className="cursor-pointer rounded-md border border-indigo-200 bg-indigo-50 p-3 shadow-sm dark:border-indigo-500/30 dark:bg-[#16233A]">
                        <div className="mb-1.5 flex items-center gap-2">
                            <FileText className="size-3.5 text-indigo-500" />
                            <h4 className="text-[10.5px] font-bold text-indigo-900 dark:text-white">Berlin Tech Intro Email</h4>
                        </div>
                        <p className="mb-2 text-[9.5px] font-medium text-indigo-700/70 dark:text-slate-400">Automated sequence step 1...</p>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">Email</span>
                            <span className="text-[9px] font-bold text-slate-500">2m ago</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Draft Editor */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#0B1220] flex-1">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#22304A]">
                    <div>
                        <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Berlin Tech Intro Email</h2>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">Generated via Copilot Prompt</p>
                    </div>
                    <div className="flex gap-2">
                         <button className="flex h-7 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[10px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#374151] dark:bg-[#111B2E] dark:text-white dark:hover:bg-[#16233A]">
                            <Edit3 className="size-3" /> Edit
                         </button>
                         <button className="h-7 rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:bg-indigo-500">
                            Publish
                         </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mx-auto max-w-[600px] space-y-4">
                        <div className="flex items-center gap-3 text-[11px]">
                            <span className="w-12 font-bold text-slate-500 dark:text-slate-400">To:</span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800 dark:bg-[#111B2E] dark:text-white">Target List: Berlin Tech (60 contacts)</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                            <span className="w-12 font-bold text-slate-500 dark:text-slate-400">Subject:</span>
                            <span className="w-full border-b border-slate-200 pb-1 font-bold text-slate-900 dark:border-[#22304A] dark:text-white">Quick question regarding Berlin Tech Expo</span>
                        </div>
                        <hr className="border-slate-100 dark:border-[#22304A]" />
                        <div className="whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-slate-700 dark:text-slate-300 space-y-4">                 
                            {`Hi {{first_name}},

Noticed your team is heading to Berlin Tech Expo next month. Are you focusing on scaling your operations workflows this quarter?

I'm putting together a small VIP dinner for ops leaders in the SaaS space on the first night of the expo, and I'd love for you to join if you're around. 

Let me know if you're open to an invite, and I'll send over the details.

Best,
Admin`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// DO VIEW
// -------------------------------------------------------------
function DoView() {
    return (
        <div className="p-4 h-full overflow-y-auto flex justify-center">
            <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#22304A] dark:bg-[#070B14]">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#22304A]">
                    <div>
                         <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Background Workflows</h2>
                         <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Copilot is currently managing the following tasks</p>
                    </div>
                    <button className="flex h-7 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-[10px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#374151] dark:bg-[#111B2E] dark:text-white dark:hover:bg-[#16233A]">
                       Pause All <Pause className="size-3" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/5">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                                <Zap className="size-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="text-[12px] font-bold text-indigo-900 dark:text-white">Enriching Target List</h4>
                                <p className="text-[10px] font-medium text-indigo-700/70 dark:text-slate-400">Processing 60 companies from Berlin Tech. 24/60 complete.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                 <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">In Progress</div>
                                 <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">Est 2 min</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-[#22304A] dark:bg-[#0B1220]">
                        <div className="flex items-center gap-3 opacity-70">
                            <div className="flex size-10 items-center justify-center rounded-full bg-slate-200 dark:bg-[#16233A]">
                                <Clock className="size-5 text-slate-500" />
                            </div>
                            <div>
                                <h4 className="text-[12px] font-bold text-slate-700 dark:text-slate-300">Deploy Intro Sequence</h4>
                                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500">Awaiting list enrichment completion to send to 60 contacts.</p>
                            </div>
                        </div>
                        <div className="text-right opacity-70">
                            <div className="text-[11px] font-bold text-slate-500">Queued</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
