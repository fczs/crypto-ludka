<?php require_once dirname(__FILE__) . '/prolog.php';

$response = $test
    ->curlRequest()
    ->getRequest('https://www.pinnacle.com/m/Mobile/en-GB/Enhanced/Regular/TestDrive/7/NoLicense/Games/Basketball-4/Market/2/487');

_r($response);
