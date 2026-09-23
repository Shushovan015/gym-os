import re

with open('src/pages/admin/AdminBilling.tsx', 'rb') as f:
    content = f.read().decode('utf-8', errors='replace')

# Normalize line endings
content = content.replace('\r\n', '\n').replace('\r', '\n')

# Replace the conflict block
old = """      </AdminDrawer>
<<<<<<< HEAD
      {billEmail.dialog}
=======
      <AdminDialog open={Boolean(sendTarget)} title={`Send bill ${sendTarget?.invoice_number ?? ""}?`} onClose={() => { if (!sendGuard.current) { recipientRequest.current += 1; setSendTarget(null); } }} footer={<div className="flex flex-wrap justify-end gap-2"><AdminButton disabled={sendingBill} onClick={() => { recipientRequest.current += 1; setSendTarget(null); }}>Cancel</AdminButton><AdminButton variant="primary" disabled={sendLoading || sendingBill || !sendRecipient || !settings.bill_sender_email} onClick={() => void sendBill()}>${sendingBill ? "Sending..." : "Confirm and send"}</AdminButton></div>}>
        <div className="space-y-3" aria-live="polite">
          {sendLoading ? <AdminLoading label="Checking member email..." /> : <p className="break-words text-sm text-slate-300">Send this invoice to <b>${sendRecipient || "the member's saved email"}</b> from <b>${settings.bill_sender_email || "an unconfigured sender"}</b>?</p>}
          <p className="text-sm text-slate-400">Includes billing details and a printable invoice. Internet is required. An invoice can only be sent once.</p>
          {!settings.bill_sender_email ? <AdminNotice tone="warning">Configure Bill sender email in System Settings first.</AdminNotice> : null}
          {sendError ? <AdminNotice tone="danger">{sendError}</AdminNotice> : null}
        </div>
      </AdminDialog>
>>>>>> origin/main
      <AdminDialog"""

new = """      </AdminDrawer>
      {billEmail.dialog}
      <AdminDialog"""

if old in content:
    content = content.replace(old, new)
    with open('src/pages/admin/AdminBilling.tsx', 'wb') as f:
        f.write(content.encode('utf-8'))
    print('Fixed!')
else:
    print('Old text not found')
    # Let's check what's there
    idx = content.find('<<<<<<< HEAD')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(content[idx:idx+300]))
    else:
        print('No conflict markers found')