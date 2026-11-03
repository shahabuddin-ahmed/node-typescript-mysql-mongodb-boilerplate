My Line manager is request to me implement rate limit in our b2c-gateway. as it is a public gateway so it is too much risk to open sensitive APIs like flight search hotel search. because in flight search we search near about 40 providers and also take about average 30 sec to get response from the provider. And we have to process lots of data per search. Because in airlines send response as a whole xml. like 1M records. And average response 25MB. Then we filter out some data as our business requirements. So a single flight search is too much server costly. So we need to add rate limit. And also another main problem is some agency, users only search flight but did not booking. some competitors direct request our API to see the specific route fare. And also chances to get system goes to down or bottleneak or spike when we received more than average request.
So need to add rate limit to our existing b2c-gateway services. our first target is add rate limit hotel and flight search api. later if require another api then just add middleware rate limit. As an rate limit standard, my line manager request to send proper message and rate limit details in http headers like when rate limit reset and how many limit is remaining and also is it sort time period daily or weekly basis period and proper status code, so that our client can aware of it regarding the rate limit.
e.g.
Rate-Limit-Remaining    remain limit
Rate-Limit-Reset	reset in time in sec
Rate-Limit-Window	window limit name

1st phase:
For initial requirement is just need to add IP wise or user wise rate limit. If user have a login then we add userID wise rate limit and if user is not loggedin then IP wise rate limit.

2nd phase:
If we add IP wise rate limit then another users may have chances to gets block as most of the user used shared IP. So for a one fraud user also impacted another real users. so we need to rate limit IP and user agent wise rate limit.

3rd phase:

After adding rate limit some user used curl a certain interval called our api as we initially rate limit per minutes wise. so this type of user block, we need to add window wise block like sort, daily, weekly etc. e.g. for sort 2 times for 5 sec request flight search, and daily 200 times and weekly 1000. times. Also add a default fallback rate limit sort 120 times for 60 sec request only. During rate limit check combine HTTP method and route path so that same route but different API can apply rate limit separately.

The final implementation will be the combine all 3 phases. And deliverables will be in TypeScript including project folder paths reserved.