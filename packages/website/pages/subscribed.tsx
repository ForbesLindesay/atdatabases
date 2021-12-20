import 'twin.macro';
import Head from 'next/head';
import React from 'react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

export default function Users() {
  return (
    <>
      <Head>
        <title>Thank You</title>
      </Head>
      <Background>
        <NavBar>
          <div tw="min-h-screen flex flex-col">
            <div tw="flex flex-col flex-grow justify-center px-6 py-24 md:py-64">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                viewBox="0 0 2000 2000"
                tw="h-48 md:h-64 w-auto mb-6"
              >
                <g transform="matrix(20,0,0,20,0,0)">
                  <path
                    d="M11.319 50.000 A40.000 40.000 0 1 0 91.319 50.000 A40.000 40.000 0 1 0 11.319 50.000 Z"
                    fill="#e8f4fa"
                    stroke="#daedf7"
                    strokeMiterlimit="10"
                  ></path>
                  <path
                    d="M86.875,48.387,81.519,21.719a3.111,3.111,0,0,0-4.342-2.107l-40.746,19a3.111,3.111,0,0,0-1.713,3.53L40.074,68.81a3.111,3.111,0,0,0,4.342,2.107l40.746-19A3.111,3.111,0,0,0,86.875,48.387Z"
                    fill="#ffffff"
                  ></path>
                  <path
                    d="M79.849,19.633a3.107,3.107,0,0,0-2.672-.021l-40.746,19a3.11,3.11,0,0,0-1.713,3.53l.19.944,21.966,5.577a8.588,8.588,0,0,0,8.67-3.374L81.357,21.222A3.109,3.109,0,0,0,79.849,19.633Z"
                    fill="#e0e0e0"
                  ></path>
                  <path
                    d="M86.875,48.387a3.11,3.11,0,0,1-1.713,3.53l-40.746,19a3.108,3.108,0,0,1-4.341-2.106L34.718,42.143a3.111,3.111,0,0,1,1.713-3.531l40.746-19a3.111,3.111,0,0,1,4.342,2.107Z"
                    fill="none"
                    stroke="#45413c"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M57.334,45.531a6.217,6.217,0,0,0,6.278-2.443L79.177,19.4a3.107,3.107,0,0,0-2,.214l-40.746,19a3.1,3.1,0,0,0-1.377,1.262Z"
                    fill="#ffffff"
                    stroke="#45413c"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M20.192 68.488L32.113 62.929"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M19.193 77.532L33.989 70.632"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M12.908 80.463L15.727 79.148"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M8.681 82.434L9.385 82.105"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M9.623 73.417L10.327 73.088"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M11.974 63.742L12.678 63.413"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M14.325 54.067L15.03 53.739"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M13.85 71.445L16.669 70.131"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M22.543 58.814L30.237 55.226"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M16.201 61.771L19.02 60.456"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M24.894 49.139L28.417 47.496"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M18.553 52.096L21.371 50.782"
                    fill="none"
                    stroke="#00b8f0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M52.954 44.419L41.744 70.897"
                    fill="#f0d5a8"
                    stroke="#45413c"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M65.965 39.507L86.935 49.464"
                    fill="#f0d5a8"
                    stroke="#45413c"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </g>
              </svg>
              <p tw="text-2xl md:text-4xl text-center">
                Please check your e-mail to confirm your subscription.
              </p>
            </div>
            <Footer />
          </div>
        </NavBar>
      </Background>
    </>
  );
}

function Background({children}: {children: React.ReactNode}) {
  return <div tw="relative bg-gray-200 overflow-hidden">{children}</div>;
}
