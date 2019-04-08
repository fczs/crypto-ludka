<?php

namespace Ludka\Utils;

class Config
{
    /**
     * Returns configuration parameters from the specified file.
     *
     * @param string $path
     * @return mixed
     */
    public static function get(string $path)
    {
        $param = explode('.', $path);
        $configPath = dirname(dirname(dirname(__DIR__))) . '/config/';
        $file = include($configPath . $param[0] . '.php');
        // variable contains the entire array of the specified file
        $var =& $file;
        // walk through all the keys of the array
        for ($i = 1; $i <= count($param) - 1; $i++) {
            $var =& $var[$param[$i]];
        }
        // final variable
        return $var;
    }
}