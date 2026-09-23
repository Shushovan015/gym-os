import re

with open('src/pages/admin/AdminBilling.tsx', 'rb') as f:
    content = f.read().decode('utf-8', errors='replace')

# Normalize line endings
content = content.replace('\r\n', '\n').replace('\r', '\n')

# Use regex to replace the conflict block
pattern = re.compile(
    r'(\s*</AdminDrawer>)\s*<<<<<<< HEAD\s*{billEmail\.dialog}\s*=======\s*<AdminDialog open=\{Boolean\(sendTarget\)\} title=\{`Send bill \$\{sendTarget\?\.\invoice_number \?\? ""\}?`\} onClose=\{\(\) => \{ if \(!sendGuard\.current\) \{ recipientRequest\.current \+= 1; setSendTarget\(null\); \} \}\} footer=\{<div className="flex flex-wrap justify-end gap-2"><AdminButton disabled=\{sendingBill\} onClick=\{\(\) => \{ recipientRequest\.current \+= 1; setSendTarget\(null\); \}\}>Cancel</AdminButton><AdminButton variant="primary" disabled=\{sendLoading \|\| sendingBill \|\| !sendRecipient \|\| !settings\.bill_sender_email\} onClick=\{\(\) => void sendBill\(\)\}>\$\{sendingBill \? "Sending\.\.\." : "Confirm and send"\}</AdminButton></div>\}>\s*<div className="space-y-3" aria-live="polite">\s*\{sendLoading \? <AdminLoading label="Checking member email\.\.\." /> : <p className="break-words text-sm text-slate-300">Send this invoice to <b>\$\{sendRecipient \|\| "the member\'s saved email"\}</b> from <b>\$\{settings\.bill_sender_email \|\| "an unconfigured sender"\}</b>\?</p>\}\s*<p className="text-sm text-slate-400">Includes billing details and a printable invoice\. Internet is required\. An invoice can only be sent once\.</p>\s*\{!settings\.bill_sender_email \? <AdminNotice tone="warning">Configure Bill sender email in System Settings first\.</AdminNotice> : null\}\s*\{sendError \? <AdminNotice tone="danger">\{sendError\}</AdminNotice> : null\}\s*</div>\s*</AdminDialog>\s*>>>>>> origin/main\s*(<AdminDialog)',
    re.DOTALL
)

new = r'\1\n      {billEmail.dialog}\n      \2'

result = pattern.sub(new, content)
if result != content:
    with open('src/pages/admin/AdminBilling.tsx', 'wb') as f:
        f.write(result.encode('utf-8'))
    print('Fixed with regex!')
else:
    print('Regex did not match')
    # Try simpler approach
    idx = content.find('<<<<<<< HEAD')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(content[idx:idx+300]))