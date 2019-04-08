<?php require_once dirname(__FILE__) . '/prolog.php';

$response = $test->curlRequest()->getRequest('https://www.pinnacle.com/m/Mobile/Sport/15');
$content = $test->pageContent()->trimContent($response);

