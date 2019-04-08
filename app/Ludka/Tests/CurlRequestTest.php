<?php

namespace Ludka\Tests;

use Ludka\Http\CurlRequest;

class CurlRequestTest
{
    public function getRequest(string $url): array
    {
        return (new CurlRequest())->get($url);
    }
}
