<?php
/**
 * FiscalGenie Lead Capture — submit.php
 * Receives JSON POST from form.js, emails Tom, stores in leads.csv
 * Configure $NOTIFY_EMAIL and optionally $WEBHOOK_URL below.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ---- CONFIGURE THESE ----
$NOTIFY_EMAIL = 'tom@quotingfast.com';  // Lead notification email
$WEBHOOK_URL  = '';                      // Optional: CRM/Zapier/Make webhook URL
$LEADS_FILE   = __DIR__ . '/leads/leads.csv';  // CSV storage
// -------------------------

// Parse body
$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (!$data || !is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

// Sanitize
$clean = [];
foreach ($data as $k => $v) {
    $clean[substr(htmlspecialchars($k, ENT_QUOTES), 0, 60)] = substr(htmlspecialchars($v, ENT_QUOTES), 0, 500);
}

$clean['_ip']   = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$clean['_time'] = date('Y-m-d H:i:s T');

// ---- Store in CSV ----
if (!is_dir(dirname($LEADS_FILE))) {
    mkdir(dirname($LEADS_FILE), 0755, true);
}

$isNew = !file_exists($LEADS_FILE);
$fh = fopen($LEADS_FILE, 'a');
if ($fh) {
    if ($isNew) {
        fputcsv($fh, array_keys($clean));
    }
    fputcsv($fh, array_values($clean));
    fclose($fh);
}

// ---- Email Notification ----
$subject = '🏠 New Mortgage Lead — ' . ($clean['loan_type'] ?? $clean['_page'] ?? 'FiscalGenie');
$name    = trim(($clean['first_name'] ?? '') . ' ' . ($clean['last_name'] ?? ''));
$body    = "New lead from FiscalGenie.com\n\n";
$body   .= "Name:    {$name}\n";
$body   .= "Email:   " . ($clean['email'] ?? 'N/A') . "\n";
$body   .= "Phone:   " . ($clean['phone'] ?? 'N/A') . "\n";
$body   .= "Zip:     " . ($clean['zip'] ?? 'N/A') . "\n";
$body   .= "\n--- Lead Details ---\n";

foreach ($clean as $k => $v) {
    if (!in_array($k, ['first_name','last_name','email','phone','zip','_ua'])) {
        $body .= ucwords(str_replace('_',' ',$k)) . ": {$v}\n";
    }
}

$headers = "From: leads@fiscalgenie.com\r\nReply-To: " . ($clean['email'] ?? '') . "\r\nX-Mailer: FiscalGenie/1.0";
@mail($NOTIFY_EMAIL, $subject, $body, $headers);

// ---- Webhook Forward (optional) ----
if ($WEBHOOK_URL) {
    $ch = curl_init($WEBHOOK_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($clean),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// ---- Jangl Ping/Post (optional — enable if posting to Jangl) ----
// Uncomment and configure if you want to sell leads to Jangl
/*
$jangl_token = 'YOUR_JANGL_TOKEN';
$jangl_endpoint = 'https://api.jangl.com/v1/leads';
$jangl_payload = [
    'first_name'  => $clean['first_name'] ?? '',
    'last_name'   => $clean['last_name'] ?? '',
    'email'       => $clean['email'] ?? '',
    'phone'       => preg_replace('/\D/', '', $clean['phone'] ?? ''),
    'address'     => '',
    'city'        => '',
    'state'       => $clean['state'] ?? '',
    'zip'         => $clean['zip'] ?? '',
    'loan_type'   => $clean['loan_type'] ?? '',
    'loan_amount' => $clean['loan_amount'] ?? '',
    'property_value' => $clean['home_value'] ?? '',
    'credit_score'   => $clean['credit_score'] ?? '',
];
$ch2 = curl_init($jangl_endpoint);
curl_setopt_array($ch2, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($jangl_payload),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$jangl_token}"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8
]);
$jangl_response = curl_exec($ch2);
curl_close($ch2);
*/

echo json_encode(['success' => true, 'message' => 'Lead captured']);
