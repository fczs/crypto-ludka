<?php

namespace Ludka\Tests;

class TestsFactory
{
    public function curlRequest(): CurlRequestTest
    {
        return new CurlRequestTest();
    }

    public function pageContent(): PageContentTest
    {
        return new PageContentTest();
    }
}
