interface ChatBubbleProps {
  sender: 'system' | 'whatsapp_fld';
  msg: string;
}

export default function ChatBubble({ sender, msg }: ChatBubbleProps) {
  if (sender === 'system') {
    return (
      <div className="text-center text-[10px] text-slate-400 my-2 italic">
        {msg}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 p-2.5 rounded-xl rounded-tl-none border border-slate-100 max-w-[90%] self-start">
      <span className="font-bold text-primary text-[10px] block">Libélulas Doradas</span>
      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{msg}</p>
    </div>
  );
}
