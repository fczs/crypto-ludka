<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ERROR);

require_once dirname(__DIR__) . '/app/autoload.php';

use Ludka\Utils\Config;

$test = new \Ludka\Tests\TestsFactory();

function _r($data)
{
    echo '<pre>';
    print_r($data);
    echo '</pre>';
}

function _v($data)
{
    var_dump($data);
}