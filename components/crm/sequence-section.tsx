"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Image as ImageIcon, Code2, Eye, Search, Type, AlignLeft, AlignCenter, Bold, Italic, Link2, List, ListOrdered, Sparkles, Languages, Info, Megaphone, X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

function LayoutField({ label, value, onChange, required = false, type = "text" }: { label: string, value: string, onChange: (v: string) => void, required?: boolean, type?: string }) {
    return (
        <div className="relative border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded flex flex-col px-3 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {label} {required && <span className="text-red-500">*</span>}
            </span>
            <input 
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] font-medium text-slate-900 dark:text-white p-0 h-6"
            />
        </div>
    );
}

export function SequenceSection() {
    const [activeTab, setActiveTab] = useState("Basic Info");
    const [isPreviewMode, setIsPreviewMode] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State mapped from screenshot demo data
    const [trackingName, setTrackingName] = useState("kevenl@groklan.com");
    const [fromName, setFromName] = useState("kevenl");
    const [replyTo, setReplyTo] = useState("kiranguttedar89@gmail.com");

    const [organizerName, setOrganizerName] = useState("kevenl Groklan");
    const [address1, setAddress1] = useState("155 3rd cross");
    const [address2, setAddress2] = useState("#rd main stage");
    const [city, setCity] = useState("San fransico");
    const [stateProvince, setStateProvince] = useState("Californai");
    const [postalCode, setPostalCode] = useState("94103");
    const [country, setCountry] = useState("American Samoa");

    const [fbLink, setFbLink] = useState("");
    const [igLink, setIgLink] = useState("");
    const [twLink, setTwLink] = useState("");

    const [rawBodyText, setRawBodyText] = useState("Write the text of your email here. Describe the events in this email and why they can't be missed.");
    const [subjectLine, setSubjectLine] = useState("Hello buddy");

    // Content Style & Extras
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [textAlign, setTextAlign] = useState("center");
    const [buttonType, setButtonType] = useState("Buy tickets");
    const [clickThroughLink, setClickThroughLink] = useState("");
    const [allEventsLink, setAllEventsLink] = useState("");
    const [emailTheme, setEmailTheme] = useState<"light" | "dark">("light");
    const [showTestEmailModal, setShowTestEmailModal] = useState(false);
    
    // Choose your Events State
    const [searchEvent, setSearchEvent] = useState("");
    const [showOnlySelected, setShowOnlySelected] = useState(false);
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
    const availableEvents = ["Berlin Tech Expo 2026", "SaaS Founders Summit", "Global AI Conference", "Web Summit Lisbon"];

    return (
        <div className="flex flex-col w-full h-[calc(100vh-60px)] bg-slate-50 dark:bg-[#0a0e1a]">
            
            {/* Top Navigation & Info - Completely outside the layout box */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[#0a0e1a] shrink-0">
                <div className="space-y-1">
                    <h1 className="text-[22px] font-bold text-slate-900 dark:text-white tracking-tight">Sequence Studio</h1>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">A premium sequence builder for trade show outreach</p>
                </div>
            </div>

            {/* Split Pane Container */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                
                {/* LEFT SIDEBAR: Settings */}
                <div className="w-full lg:w-[400px] shrink-0 border-r border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#111B2E] overflow-y-auto flex flex-col h-full shadow-sm">
                    {/* Tabs */}
                    <div className="flex px-4 border-b border-slate-200 dark:border-white/[0.06] pt-2 shrink-0">
                        {["Basic Info", "Content", "Style"].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 pb-3 text-[13px] font-bold transition-all relative",
                                    activeTab === tab ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                )}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div layoutId="seqTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6 space-y-8 flex-1 overflow-y-auto hidden-scrollbar pb-24">
                        {activeTab === "Basic Info" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                
                                {/* Tracking Info Section (Replaced Campaign Info per user request) */}
                                <section className="space-y-4">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Tracking information</h2>
                                    <div className="space-y-3">
                                        <LayoutField label="Tracking name" value={trackingName} onChange={setTrackingName} required />
                                        <LayoutField label="From" value={fromName} onChange={setFromName} required />
                                        <LayoutField label="Reply to email address" value={replyTo} onChange={setReplyTo} required />
                                    </div>
                                </section>

                                {/* Footer Section */}
                                <section className="space-y-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Footer</h2>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                                            To help your email go through to inboxes instead of spam, the best practice is to have these filled out.
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <LayoutField label="Organizer name" value={organizerName} onChange={setOrganizerName} required />
                                        <LayoutField label="Address 1" value={address1} onChange={setAddress1} required />
                                        <LayoutField label="Address 2" value={address2} onChange={setAddress2} />
                                        <LayoutField label="City" value={city} onChange={setCity} required />
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <LayoutField label="State/Province" value={stateProvince} onChange={setStateProvince} />
                                            <LayoutField label="Postal Code" value={postalCode} onChange={setPostalCode} required />
                                        </div>
                                        
                                        <div className="relative border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded flex flex-col px-3 py-1.5 cursor-pointer">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                Country <span className="text-red-500">*</span>
                                            </span>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] font-medium text-slate-900 dark:text-white">{country}</span>
                                                <ChevronDown className="size-3 text-slate-400" />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Social Links */}
                                <section className="space-y-3">
                                    <LayoutField label="Facebook link" value={fbLink} onChange={setFbLink} />
                                    <LayoutField label="Instagram link" value={igLink} onChange={setIgLink} />
                                    <LayoutField label="Twitter link" value={twLink} onChange={setTwLink} />
                                </section>

                                {/* Organizer Logo Upload */}
                                <section className="space-y-3">
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-colors rounded-lg py-8 group"
                                    >
                                        <ImageIcon className="size-8 text-slate-300 dark:text-slate-500 mb-3 group-hover:scale-110 transition-transform" />
                                        <span className="text-[14px] font-bold text-slate-900 dark:text-white">Add organizer logo</span>
                                        <span className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Drag-drop or click here to choose a file</span>
                                    </button>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        The logo appears above the content. We recommend using at least a 150x75px (2:1 ratio) image that is no larger than 1MB.
                                    </p>
                                </section>

                            </motion.div>
                        )}
                        {activeTab === "Content" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                
                                {/* Choose your events */}
                                <section className="space-y-4">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Choose your events</h2>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                                            <input 
                                                type="text" 
                                                placeholder="Search for events" 
                                                value={searchEvent}
                                                onChange={(e) => setSearchEvent(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 text-[13px] bg-transparent border border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none dark:text-white"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch checked={showOnlySelected} onCheckedChange={setShowOnlySelected} className="scale-75 origin-left" />
                                            <span className="text-[11px] text-slate-600 dark:text-slate-400">Show only selected</span>
                                        </div>
                                        
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden bg-slate-50 dark:bg-[#111B2E]">
                                            <div className="px-3 py-2 bg-slate-100 dark:bg-[#16233A] border-b border-slate-200 dark:border-slate-700">
                                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Events</span>
                                            </div>
                                            <div className="max-h-32 overflow-y-auto hidden-scrollbar flex flex-col">
                                                {availableEvents
                                                    .filter(ev => ev.toLowerCase().includes(searchEvent.toLowerCase()))
                                                    .filter(ev => !showOnlySelected || selectedEvents.includes(ev))
                                                    .map(event => (
                                                    <label key={event} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-0 group">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedEvents.includes(event)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedEvents([...selectedEvents, event]);
                                                                else setSelectedEvents(selectedEvents.filter(ev => ev !== event));
                                                            }}
                                                            className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                        <span className="text-[12px] text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{event}</span>
                                                    </label>
                                                ))}
                                                {availableEvents.filter(ev => ev.toLowerCase().includes(searchEvent.toLowerCase())).length === 0 && (
                                                    <div className="px-3 py-4 text-center text-[11px] text-slate-500 dark:text-slate-400">No events found</div>
                                                )}
                                                {!showOnlySelected && selectedEvents.length === 0 && searchEvent === "" && (
                                                    <div className="px-3 py-4 text-center text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0B1220]">No events selected</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Subject */}
                                <section className="space-y-4">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Subject</h2>
                                    <LayoutField label="Subject" value={subjectLine} onChange={setSubjectLine} required />
                                </section>

                                {/* Body Editor */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Body</h2>
                                        <div className="flex items-center gap-3">
                                            <button className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                                                <Sparkles className="size-3.5" /> Write my email
                                            </button>
                                            <Info className="size-4 text-slate-400" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-2">
                                        <button className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
                                            <Languages className="size-3.5" /> Translate
                                            <span className="text-[8px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1 py-0.5 rounded shadow-sm border border-amber-200 dark:border-amber-500/30 ml-0.5">PRO</span>
                                        </button>
                                    </div>
                                    
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-[#0B1220] overflow-hidden shadow-sm">
                                        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2E]">
                                            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Type className="size-4" /></button>
                                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                            <button onClick={() => setTextAlign('left')} className={cn("p-1 rounded text-slate-600 dark:text-slate-300", textAlign === 'left' ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "hover:bg-slate-200 dark:hover:bg-slate-700")}>
                                                <AlignLeft className="size-4" />
                                            </button>
                                            <button onClick={() => setTextAlign('center')} className={cn("p-1 rounded text-slate-600 dark:text-slate-300", textAlign === 'center' ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "hover:bg-slate-200 dark:hover:bg-slate-700")}>
                                                <AlignCenter className="size-4" />
                                            </button>
                                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                            <button onClick={() => setIsBold(!isBold)} className={cn("p-1 rounded text-slate-600 dark:text-slate-300", isBold ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "hover:bg-slate-200 dark:hover:bg-slate-700")}><Bold className="size-4" /></button>
                                            <button onClick={() => setIsItalic(!isItalic)} className={cn("p-1 rounded text-slate-600 dark:text-slate-300", isItalic ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "hover:bg-slate-200 dark:hover:bg-slate-700")}><Italic className="size-4" /></button>
                                            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Link2 className="size-4" /></button>
                                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><List className="size-4" /></button>
                                            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ListOrdered className="size-4" /></button>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-[#0a0e1a]">
                                            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white text-center mb-3">Email Header</h3>
                                            <textarea 
                                                value={rawBodyText}
                                                onChange={(e) => setRawBodyText(e.target.value)}
                                                className={cn(
                                                    "w-full h-32 bg-transparent border-none outline-none resize-none text-[13px] placeholder-slate-400 text-slate-700 dark:text-slate-300",
                                                    isBold && "font-bold",
                                                    isItalic && "italic",
                                                    textAlign === "center" ? "text-center" : "text-left"
                                                )}
                                                placeholder="Write the text of your email here..."
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Select Button Text */}
                                <section className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Select button text</h2>
                                        <span className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 font-bold">
                                            <Megaphone className="size-3" /> New
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {["Tickets", "Buy tickets", "Register", "RSVP"].map(btn => (
                                            <label key={btn} className="flex items-center gap-2 cursor-pointer group">
                                                <div className="relative flex items-center justify-center size-4 rounded-full border border-slate-300 dark:border-slate-600 group-hover:border-indigo-400 transition-colors">
                                                    {buttonType === btn && <div className="size-2.5 rounded-full bg-indigo-600"></div>}
                                                    <input 
                                                        type="radio" 
                                                        name="btnGroup" 
                                                        value={btn}
                                                        checked={buttonType === btn}
                                                        onChange={() => setButtonType(btn)}
                                                        className="opacity-0 absolute inset-0 cursor-pointer"
                                                    />
                                                </div>
                                                <span className="text-[13px] text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{btn}</span>
                                            </label>
                                        ))}
                                    </div>
                                </section>

                                {/* Header Image */}
                                <section className="space-y-3 pb-2">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Header Image</h2>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-colors rounded-lg py-8 group"
                                    >
                                        <ImageIcon className="size-8 text-slate-300 dark:text-slate-500 mb-3 group-hover:scale-110 transition-transform" />
                                        <span className="text-[14px] font-bold text-slate-900 dark:text-white">Add header image</span>
                                        <span className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Drag-drop or click here to choose a file</span>
                                    </button>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        The image appears in the content, above the content text. We recommend using at least a 2160x1080px (2:1 ratio) image that's no larger than 1MB.
                                    </p>
                                </section>

                                {/* Add click-through link */}
                                <section className="space-y-3 pb-2">
                                    <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Add a click-through link to your page</h2>
                                    <div className="relative border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-[#111B2E] rounded flex items-center px-3 py-2 overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
                                        <Link2 className="size-4 text-slate-400 mr-2 shrink-0" />
                                        <input 
                                            type="url"
                                            placeholder="Add a link"
                                            value={clickThroughLink}
                                            onChange={e => setClickThroughLink(e.target.value)}
                                            className="w-full bg-transparent border-none outline-none text-[13px] text-slate-900 dark:text-white placeholder-slate-400"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Your URL must be an Eventbrite link and start with http:// or https://</p>
                                </section>

                                {/* Discover more events */}
                                <section className="space-y-4">
                                    <div>
                                        <h2 className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight">Discover more events</h2>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                                            Include link to your upcoming events. We suggest using your organizer profile.
                                        </p>
                                    </div>
                                    <div className="relative border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-[#111B2E] rounded flex items-center px-3 py-2 overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all mb-1">
                                        <Link2 className="size-4 text-slate-400 mr-2 shrink-0" />
                                        <input 
                                            type="url"
                                            placeholder="Link to view all events"
                                            value={allEventsLink}
                                            onChange={e => setAllEventsLink(e.target.value)}
                                            className="w-full bg-transparent border-none outline-none text-[13px] text-slate-900 dark:text-white placeholder-slate-400"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Your URL needs to start with http:// or https://</p>
                                </section>

                            </motion.div>
                        )}
                        {activeTab === "Style" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                {/* Header Image */}
                                <section className="space-y-3 pb-2">
                                    <h2 className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight">Background image</h2>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-colors rounded-lg py-8 group"
                                    >
                                        <ImageIcon className="size-8 text-slate-300 dark:text-slate-500 mb-3 group-hover:scale-110 transition-transform" />
                                        <span className="text-[14px] font-bold text-slate-900 dark:text-white">Add background image</span>
                                        <span className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Drag-drop or click here to choose a file</span>
                                    </button>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[320px]">
                                        This image goes behind your content, and will replace the Border. If the image is not large enough to fill the window, the image will repeat. We recommend using at least 1000px wide image that is no larger than 1MB.
                                    </p>
                                </section>

                                {/* Theme Settings */}
                                <section className="space-y-3 pb-2">
                                    <h2 className="text-[14px] font-bold text-slate-900 dark:text-white tracking-tight">Email Theme</h2>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setEmailTheme('light')}
                                            className={cn(
                                                "flex-1 h-10 rounded border font-bold text-[13px] transition-colors",
                                                emailTheme === 'light' ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            Light
                                        </button>
                                        <button 
                                            onClick={() => setEmailTheme('dark')}
                                            className={cn(
                                                "flex-1 h-10 rounded border font-bold text-[13px] transition-colors",
                                                emailTheme === 'dark' ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            Dark
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Choose the base layout visibility theme for the email reader context so audiences can view it natively matching their system defaults.
                                    </p>
                                </section>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANE: Email Preview */}
                <div className="flex-1 flex flex-col px-6 lg:px-12 pt-6 lg:pt-10 overflow-y-auto pb-24">
                    
                    {/* Top Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <h1 className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight">
                            {trackingName || "kevenl@groklan.com"}
                        </h1>
                        
                        <div className="flex items-center gap-2">
                            {/* Toggle Button for manual edit vs preview */}
                            <button 
                                onClick={() => setIsPreviewMode(!isPreviewMode)}
                                title={isPreviewMode ? "Switch to Manual Edit" : "Switch to Live Preview"}
                                className="flex items-center justify-center size-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                            >
                                {isPreviewMode ? <Code2 className="size-4" /> : <Eye className="size-4" />}
                            </button>
                            
                            <button 
                                onClick={() => {
                                    if (!address1 || !city || !stateProvince || !postalCode || !country) {
                                        alert("Please make sure Address 1, City, State/Province, Postal Code, and Country are correctly filled under the Basic Info tab before sending a test.");
                                        return;
                                    }
                                    setShowTestEmailModal(true);
                                }} 
                                className="h-9 px-4 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                            >
                                Send test email
                            </button>
                        </div>
                    </div>

                    {/* Email Preview Card */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "rounded-xl shadow-lg border overflow-hidden flex flex-col max-w-[800px] mx-auto w-full shrink-0 transition-colors duration-500",
                            emailTheme === 'dark' ? "bg-[#0B1220] border-slate-800/60" : "bg-white border-slate-200 dark:bg-[#111B2E] dark:border-white/[0.06]"
                        )}
                    >
                        {/* Meta Header */}
                        <div className={cn("p-8 pb-6 border-b", emailTheme === 'dark' ? "border-slate-800/60" : "border-slate-100 dark:border-slate-800/60")}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={cn("text-[13px] font-medium w-16", emailTheme === 'dark' ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>Subject:</span>
                                <span className={cn("text-[13px] font-medium", emailTheme === 'dark' ? "text-white" : "text-slate-900 dark:text-white")}>{subjectLine}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-[13px] font-medium w-16", emailTheme === 'dark' ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>From:</span>
                                <span className={cn("text-[13px] font-bold", emailTheme === 'dark' ? "text-white" : "text-slate-900 dark:text-white")}>{fromName}</span>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="p-10 flex flex-col min-h-[300px]" style={{ alignItems: textAlign === 'center' ? 'center' : 'flex-start', textAlign: textAlign as 'left' | 'center' }}>
                            <h2 className={cn("text-[22px] font-bold mb-6", emailTheme === 'dark' ? "text-white" : "text-slate-900 dark:text-white")}>Email Header</h2>
                            
                            {isPreviewMode ? (
                                <p 
                                    className={cn(
                                        "text-[15px] max-w-[450px] leading-relaxed",
                                        emailTheme === 'dark' ? "text-slate-300" : "text-slate-600 dark:text-slate-300",
                                        isBold ? "font-bold" : "font-medium",
                                        isItalic && "italic"
                                    )}
                                >
                                    {rawBodyText}
                                </p>
                            ) : (
                                <textarea 
                                    value={rawBodyText}
                                    onChange={(e) => setRawBodyText(e.target.value)}
                                    className={cn(
                                        "w-full max-w-[500px] h-32 p-4 text-[14px] bg-slate-50 dark:bg-[#0a0e1a] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 resize-none",
                                        isBold && "font-bold",
                                        isItalic && "italic",
                                        textAlign === "center" ? "text-center" : "text-left"
                                    )}
                                    placeholder="Write the text of your email here..."
                                />
                            )}
                            
                            {/* Selected Event Context */}
                            {selectedEvents.length > 0 && (
                                <div className="mt-6 flex flex-col gap-2 p-4 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 max-w-[450px]">
                                    <span className="text-[12px] font-bold text-indigo-900 dark:text-indigo-300">Featured Events:</span>
                                    {selectedEvents.map(ev => <span key={ev} className="text-[12px] text-indigo-700 dark:text-indigo-400 leading-tight flex items-center gap-1.5"><div className="size-1.5 rounded-full bg-indigo-500 shrink-0"></div> {ev}</span>)}
                                </div>
                            )}

                            {/* Button Action */}
                            <button className="mt-8 px-6 py-2.5 rounded text-[13px] font-bold text-white bg-[#D9531E] hover:bg-[#c44919] transition-colors shadow-sm">
                                {buttonType}
                            </button>

                            {/* Additional Links Context */}
                            {allEventsLink && (
                                <p className="mt-8 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                    <a href="#" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">View all upcoming events</a> from {organizerName || "this organizer"}
                                </p>
                            )}
                        </div>

                        {/* Email Footer Preview */}
                        <div className={cn("p-8 border-t flex flex-col items-center justify-center text-center mt-auto", emailTheme === 'dark' ? "bg-[#070B14] border-slate-800/60" : "bg-slate-50 dark:bg-[#070B14] border-slate-100 dark:border-slate-800/60")}>
                            <p className={cn("text-[11px] font-medium mb-1", emailTheme === 'dark' ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>{organizerName}</p>
                            <p className={cn("text-[11px] font-medium mb-3", emailTheme === 'dark' ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                                {address1} {address2 ? `, ${address2}` : ''}, {city}, {stateProvince} {postalCode} {country === "American Samoa" ? "AS" : ""}
                            </p>
                            <p className={cn("text-[11px] font-medium", emailTheme === 'dark' ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                                <a href="#" className="hover:text-slate-200 underline decoration-slate-600 underline-offset-2">Unsubscribe</a>
                                {" | "} 
                                <a href="#" className="hover:text-slate-200 underline decoration-slate-600 underline-offset-2">Privacy Policy</a>
                            </p>
                        </div>
                    </motion.div>

                    {/* Bottom Actions */}
                    <div className="mt-8 mb-4 max-w-[800px] mx-auto w-full flex justify-end gap-3 shrink-0">
                        <button className="h-10 px-6 rounded bg-white dark:bg-[#111B2E] border border-slate-300 dark:border-slate-700 text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                            Cancel
                        </button>
                        <button className="h-10 px-6 rounded bg-[#D9531E] hover:bg-[#c44919] text-[13px] font-bold text-white transition-colors shadow-sm">
                            Continue
                        </button>
                    </div>
                </div>
                
            </div>
            
            {/* Test Email Modal */}
            <AnimatePresence>
                {showTestEmailModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowTestEmailModal(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} 
                            animate={{ scale: 1, opacity: 1, y: 0 }} 
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white dark:bg-[#111B2E] w-full max-w-[550px] rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative z-10"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white mx-auto">Send a test email</h2>
                                <button onClick={() => setShowTestEmailModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-4 transition-colors"><X className="size-4"/></button>
                            </div>
                            <div className="p-6">
                                <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300 text-center mb-6">Preview your email campaign before sharing with your audience</p>
                                
                                <div className="flex items-center gap-4 p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 rounded-lg mb-8 shadow-sm">
                                    <div className="size-10 bg-white dark:bg-slate-800 rounded flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                        <Mail className="size-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-bold text-slate-900 dark:text-white">Subject: {subjectLine}</div>
                                        <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">From: {fromName}</div>
                                    </div>
                                </div>

                                <p className="text-[12px] font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Send test email to:</p>
                                <div className="relative border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded flex flex-col px-3 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Email</span>
                                    <input 
                                        type="email"
                                        defaultValue={trackingName || "kevenl@groklan.com"}
                                        className="bg-transparent border-none outline-none text-[13px] font-medium text-slate-900 dark:text-white p-0 h-6"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <button onClick={() => setShowTestEmailModal(false)} className="h-10 px-6 rounded bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-700 text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                    Cancel
                                </button>
                                <button onClick={() => setShowTestEmailModal(false)} className="h-10 px-6 rounded bg-[#D9531E] hover:bg-[#c44919] text-[13px] font-bold text-white transition-colors shadow-sm">
                                    Send test email
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
