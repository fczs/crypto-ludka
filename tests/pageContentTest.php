<?php require_once dirname(__FILE__) . '/prolog.php';

$content = $test->pageContent()->getContent(
    'https://www.pinnacle.com/m/Mobile/en-GB/Enhanced/Regular/TestDrive/7/NoLicense/Games/Basketball-4/Market/2/493',
    '//*[contains(@class, "list-group-item list-group-item-light col-xs-12 ajax-me")]'
);

//https://stackoverflow.com/questions/6366351/getting-dom-elements-by-classname

_r($content);